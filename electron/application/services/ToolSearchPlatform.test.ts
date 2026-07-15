import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../../domain/entities/agent.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import { extractLoadedToolNames } from './toolSearchHistory.js';
import { ToolSearchPlatform } from './ToolSearchPlatform.js';

const read = tool('read_file', false);
const team = tool('TeamCreate', true);
const task = tool('task_update', true);
const mcp = { ...tool('mcp_deadbeef_create_issue', false), source: { kind: 'mcp' as const, serverId: 'github', remoteToolName: 'create_issue' } };

describe('ToolSearchPlatform', () => {
  it('announces names without schemas, loads matches, and then delegates them', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'delegated' }));
    const platform = createPlatform([read, team, task, mcp], execute);
    const initial = await platform.list('/workspace');
    expect(initial.map((item) => item.name)).toEqual(['read_file', 'ToolSearch']);
    expect(initial.at(-1)?.description).toContain('TeamCreate');
    expect(JSON.stringify(initial)).not.toContain('team secret schema marker');
    await expect(platform.execute('TeamCreate', {}, '/workspace', 'workspace-write'))
      .resolves.toMatchObject({ ok: false, output: expect.stringContaining('deferred') });

    const searched = await platform.execute('ToolSearch', { query: 'select:TeamCreate' }, '/workspace', 'read-only');
    expect(searched.ok).toBe(true);
    expect(searched.output).toContain('<functions>');
    expect(JSON.parse(searched.output.split('\n', 1)[0]).matches).toEqual(['TeamCreate']);
    expect((await platform.list('/workspace')).map((item) => item.name)).toEqual(['read_file', 'TeamCreate', 'ToolSearch']);
    await platform.execute('TeamCreate', {}, '/workspace', 'workspace-write');
    expect(execute).toHaveBeenCalledWith('TeamCreate', {}, '/workspace', 'workspace-write', undefined);
  });

  it('always defers MCP tools and restores selected names from durable messages', async () => {
    const messages: Message[] = [{
      id: 'step-1', sender: 'agent',
      content: '[tool:ToolSearch] {"query":"mcp"}\n[ok]\n{"matches":["mcp_deadbeef_create_issue"],"query":"mcp","total_deferred_tools":1}\n<functions>...</functions>',
    }];
    const restored = extractLoadedToolNames(messages);
    expect([...restored]).toEqual(['mcp_deadbeef_create_issue']);
    const platform = createPlatform([read, mcp], vi.fn(), restored);
    expect((await platform.list('/workspace')).map((item) => item.name)).toEqual(['read_file', 'mcp_deadbeef_create_issue', 'ToolSearch']);
  });

  it('bounds schema output and ignores malformed historical envelopes', async () => {
    const huge = { ...tool('huge_tool', true), description: 'x'.repeat(110_000) };
    const platform = createPlatform([read, huge], vi.fn());
    const result = await platform.execute('ToolSearch', { query: 'select:huge_tool' }, '/workspace', 'read-only');
    expect(result.output.length).toBeLessThanOrEqual(100_000);
    expect(JSON.parse(result.output).matches).toEqual([]);
    expect([...extractLoadedToolNames([{ id: 'bad', sender: 'agent', content: '[tool:ToolSearch] {}\n[ok]\n{"matches":["../bad"]}' }])]).toEqual([]);
  });

  it('always exposes ToolSearch and discovers MCP tools added after session start', async () => {
    const tools = [read];
    const platform = new ToolSearchPlatform(
      { list: async () => tools }, { execute: vi.fn() }, { currentRoot: (fallback) => fallback },
    );
    expect((await platform.list('/workspace')).map((item) => item.name)).toEqual(['read_file', 'ToolSearch']);
    tools.push(mcp);
    const result = await platform.execute('ToolSearch', { query: 'create issue' }, '/workspace', 'read-only');
    expect(JSON.parse(result.output.split('\n', 1)[0]).matches).toEqual(['mcp_deadbeef_create_issue']);
    expect((await platform.list('/workspace')).map((item) => item.name)).toContain('mcp_deadbeef_create_issue');
  });

  it('returns a bounded failure when the dynamic catalog cannot be read', async () => {
    const platform = new ToolSearchPlatform(
      { list: async () => { throw new Error('catalog unavailable'); } },
      { execute: vi.fn() },
      { currentRoot: (fallback) => fallback },
    );
    await expect(platform.execute('ToolSearch', { query: 'task' }, '/workspace', 'read-only'))
      .resolves.toEqual({ ok: false, output: 'catalog unavailable' });
  });
});

function createPlatform(tools: AgentToolDefinition[], execute: ReturnType<typeof vi.fn>, loaded: Iterable<string> = []) {
  return new ToolSearchPlatform(
    { list: async () => tools }, { execute: execute as IToolExecutor['execute'] }, { currentRoot: (fallback) => fallback }, loaded,
  );
}

function tool(name: string, deferLoading: boolean): AgentToolDefinition {
  return {
    name, description: `${name} description`, risk: 'read', deferLoading,
    parameters: { type: 'object', properties: { marker: { type: 'string', description: name === 'TeamCreate' ? 'team secret schema marker' : '' } } },
  };
}
