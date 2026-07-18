import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpResourceToolPlatform } from '../../application/services/McpResourceToolPlatform.js';
import { ListMcpResources } from '../../application/usecases/ListMcpResources.js';
import { ReadMcpResource } from '../../application/usecases/ReadMcpResource.js';
import { LIST_MCP_RESOURCES_TOOL_NAME } from '../../domain/entities/mcpResource.js';
import type { IMcpResourceGateway } from '../../domain/ports/IMcpResourceGateway.js';
import { AgentToolExecutor } from '../tools/AgentToolExecutor.js';
import { PrivateMcpResourceArtifactStore } from './PrivateMcpResourceArtifactStore.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('MCP artifact read integration', () => {
  it('reads its saved oversized result in workspace-write while normal read_file stays local', async () => {
    const container = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-studio-mcp-read-'));
    roots.push(container);
    const root = path.join(container, 'workspace');
    await fs.mkdir(root);
    await fs.writeFile(path.join(root, 'notes.txt'), 'workspace content');
    const artifacts = new PrivateMcpResourceArtifactStore(() => path.join(container, 'private-artifacts'));
    const gateway: IMcpResourceGateway = {
      listServers: vi.fn(async () => [{ id: 'docs', name: 'docs', state: 'connected' as const, supportsResources: true }]),
      listResources: vi.fn(async () => [{ uri: 'docs://large', name: 'x'.repeat(100_001), server: 'docs' }]),
      readResource: vi.fn(async () => []),
    };
    const remote = {
      list: vi.fn(async () => []),
      execute: vi.fn(async () => ({ ok: false, output: 'remote fallback' })),
    };
    const mcp = new McpResourceToolPlatform(
      remote, remote, new ListMcpResources(gateway), new ReadMcpResource(gateway, artifacts), artifacts,
    );
    const tools = new AgentToolExecutor({ provider: 'disabled' }, undefined, mcp, mcp);

    const readDefinition = (await tools.list(root)).find((tool) => tool.name === 'read_file');
    expect(readDefinition?.description).toContain('Private MCP JSON/text artifacts');
    const oversized = await tools.execute(LIST_MCP_RESOURCES_TOOL_NAME, {}, root, 'workspace-write');
    const savedPath = oversized.output.match(/saved to (.+)\n/)?.[1];
    expect(savedPath).toBeTruthy();

    const chunk = await tools.execute('read_file', { path: savedPath, offset: 0, limit: 32 }, root, 'workspace-write');
    expect(chunk).toMatchObject({ ok: true });
    expect(chunk.output).toContain('[{"uri":"docs://large"');
    expect(chunk.output).toContain('continue with offset=32');
    const traversal = `${path.dirname(savedPath!)}${path.sep}nested${path.sep}..${path.sep}${path.basename(savedPath!)}`;
    await expect(tools.execute('read_file', { path: traversal }, root, 'workspace-write'))
      .resolves.toMatchObject({ ok: false });
    const foreign = path.join(container, 'private-artifacts', 'mcp-tool-result-foreign.json');
    await fs.writeFile(foreign, 'foreign private content');
    await expect(tools.execute('read_file', { path: foreign }, root, 'workspace-write'))
      .resolves.toMatchObject({ ok: false });
    await expect(tools.execute('read_file', { path: 'notes.txt' }, root, 'workspace-write'))
      .resolves.toEqual({ ok: true, output: 'workspace content' });
  });
});
