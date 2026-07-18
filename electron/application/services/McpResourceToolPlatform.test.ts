import { describe, expect, it, vi } from 'vitest';
import {
  LIST_MCP_RESOURCES_TOOL_NAME,
  MCP_RESOURCE_TOOL_DEFINITIONS,
  READ_MCP_RESOURCE_TOOL_NAME,
  type McpResourceDescriptor,
  type McpResourceServer,
} from '../../domain/entities/mcpResource.js';
import type { IMcpResourceArtifactStore } from '../../domain/ports/IMcpResourceArtifactStore.js';
import type { IMcpResourceGateway } from '../../domain/ports/IMcpResourceGateway.js';
import { ListMcpResources } from '../usecases/ListMcpResources.js';
import { ReadMcpResource } from '../usecases/ReadMcpResource.js';
import { McpResourceToolPlatform } from './McpResourceToolPlatform.js';

function createHarness(input?: { servers?: McpResourceServer[]; resources?: McpResourceDescriptor[] }) {
  const servers = input?.servers ?? [{ id: 'docs', name: 'docs', state: 'connected' as const, supportsResources: true }];
  const resources = input?.resources ?? [{ uri: 'docs://guide', name: 'Guide', mimeType: 'text/plain', server: 'docs' }];
  const gateway: IMcpResourceGateway = {
    listServers: vi.fn(async () => servers),
    listResources: vi.fn(async () => resources),
    readResource: vi.fn(async () => [{ uri: 'docs://guide', mimeType: 'text/plain', text: 'hello' }]),
  };
  const artifacts: IMcpResourceArtifactStore = {
    persistBase64: vi.fn(async () => ({ path: '/private/resource.bin', size: 3 })),
    persistToolResult: vi.fn(async () => ({ path: '/private/result.json', size: 100_001 })),
    canReadTextArtifact: vi.fn((candidate) => candidate === '/private/result.json'),
    readTextArtifact: vi.fn(async ({ offset, limit }) => ({
      content: 'saved result'.slice(offset, offset + limit), offset,
      ...(offset + limit < 12 ? { nextOffset: offset + limit } : {}),
      totalCharacters: 12,
    })),
  };
  const base = {
    list: vi.fn(async () => [{ name: 'remote', description: 'remote', risk: 'read' as const, parameters: {} }]),
    execute: vi.fn(async () => ({ ok: true, output: 'remote result' })),
  };
  const platform = new McpResourceToolPlatform(
    base, base, new ListMcpResources(gateway), new ReadMcpResource(gateway, artifacts), artifacts,
  );
  return { platform, gateway, artifacts, base };
}

describe('McpResourceToolPlatform', () => {
  it('exposes the exact deferred read-only contracts only when resources are supported', async () => {
    const { platform } = createHarness();
    const tools = await platform.list('/workspace');
    expect(tools.map((tool) => tool.name)).toEqual(['remote', LIST_MCP_RESOURCES_TOOL_NAME, READ_MCP_RESOURCE_TOOL_NAME]);
    expect(MCP_RESOURCE_TOOL_DEFINITIONS).toMatchObject([
      { risk: 'read', readOnly: true, concurrencySafe: true, deferLoading: true },
      { risk: 'read', readOnly: true, concurrencySafe: true, deferLoading: true, parameters: { required: ['server', 'uri'] } },
    ]);
    expect(Object.hasOwn(MCP_RESOURCE_TOOL_DEFINITIONS[0].parameters, 'required')).toBe(false);
    const unavailable = createHarness({ servers: [{ id: 'docs', name: 'docs', state: 'stopped', supportsResources: false }] });
    expect((await unavailable.platform.list('/workspace')).map((tool) => tool.name)).toEqual(['remote']);
  });

  it('decorates read_file and intercepts only owned private text artifacts', async () => {
    const { platform, base } = createHarness();
    const [readFile] = platform.decorateTools([{
      name: 'read_file', description: 'Read workspace text.', risk: 'read', parameters: {
        properties: { path: { type: 'string' } }, required: ['path'],
      },
    }]);
    expect(readFile.description).toContain('Private MCP JSON/text artifacts');
    expect(readFile.parameters).toMatchObject({ properties: {
      path: { type: 'string' }, offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', maximum: 100_000 },
    } });

    const owned = await platform.execute('read_file', { path: '/private/result.json', offset: 1, limit: 4 }, '/workspace', 'workspace-write');
    expect(owned).toEqual({ ok: true, output: 'aved\n\n[MCP artifact characters 1-5 of 12; continue with offset=5]' });
    await platform.execute('read_file', { path: 'README.md' }, '/workspace', 'workspace-write');
    expect(base.execute).toHaveBeenCalledWith('read_file', { path: 'README.md' }, '/workspace', 'workspace-write', undefined);
  });

  it('lists all resources, filters by exact server name, and preserves the empty-result message', async () => {
    const { platform, gateway } = createHarness();
    const result = await platform.execute(LIST_MCP_RESOURCES_TOOL_NAME, { server: 'docs' }, '/workspace', 'read-only');
    expect(result).toEqual({ ok: true, output: JSON.stringify([{ uri: 'docs://guide', name: 'Guide', mimeType: 'text/plain', server: 'docs' }]) });
    expect(gateway.listResources).toHaveBeenCalledWith('docs', undefined);

    vi.mocked(gateway.listResources).mockResolvedValueOnce([]);
    const empty = await platform.execute(LIST_MCP_RESOURCES_TOOL_NAME, {}, '/workspace', 'read-only');
    expect(empty.output).toBe('No resources found. MCP servers may still provide tools even if they have no resources.');
  });

  it('reads text and replaces binary base64 with a private artifact path', async () => {
    const { platform, gateway, artifacts } = createHarness();
    vi.mocked(gateway.readResource).mockResolvedValueOnce([
      { uri: 'docs://guide', mimeType: 'text/plain', text: 'hello' },
      { uri: 'docs://image', mimeType: 'image/png', blob: 'YWJj' },
    ]);
    const result = await platform.execute(READ_MCP_RESOURCE_TOOL_NAME, { server: 'docs', uri: 'docs://guide' }, '/workspace', 'read-only');
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.output)).toEqual({ contents: [
      { uri: 'docs://guide', mimeType: 'text/plain', text: 'hello' },
      expect.objectContaining({ uri: 'docs://image', mimeType: 'image/png', blobSavedTo: '/private/resource.bin' }),
    ] });
    expect(artifacts.persistBase64).toHaveBeenCalledWith({ base64: 'YWJj', mimeType: 'image/png' });
  });

  it('isolates list failures and returns reference-style server errors', async () => {
    const servers: McpResourceServer[] = [
      { id: 'one', name: 'one', state: 'connected', supportsResources: true },
      { id: 'two', name: 'two', state: 'connected', supportsResources: true },
    ];
    const { platform, gateway } = createHarness({ servers });
    vi.mocked(gateway.listResources).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([
      { uri: 'two://doc', name: 'doc', server: 'two' },
    ]);
    expect(await platform.execute(LIST_MCP_RESOURCES_TOOL_NAME, {}, '/workspace', 'read-only')).toEqual({
      ok: true, output: JSON.stringify([{ uri: 'two://doc', name: 'doc', server: 'two' }]),
    });
    const missing = await platform.execute(READ_MCP_RESOURCE_TOOL_NAME, { server: 'missing', uri: 'x://y' }, '/workspace', 'read-only');
    expect(missing).toEqual({ ok: false, output: 'Server "missing" not found. Available servers: one, two' });
  });

  it('persists oversized JSON instead of sending it to the model', async () => {
    const huge = 'x'.repeat(100_001);
    const { platform, artifacts } = createHarness({ resources: [{ uri: 'docs://guide', name: huge, server: 'docs' }] });
    const result = await platform.execute(LIST_MCP_RESOURCES_TOOL_NAME, {}, '/workspace', 'read-only');
    expect(result.ok).toBe(true);
    expect(result.output).toContain('Output has been saved to /private/result.json');
    expect(artifacts.persistToolResult).toHaveBeenCalledOnce();
  });
});
