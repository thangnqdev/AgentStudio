import { describe, expect, it, vi } from 'vitest';
import type { ToolResult } from '../../domain/entities/agent.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import { CompatibilityToolPlatform } from './CompatibilityToolPlatform.js';

const definitions: AgentToolDefinition[] = [
  tool('read_file', 'read'), tool('write_file', 'write'), tool('apply_patch', 'write'),
  tool('glob', 'read'), tool('grep', 'read'), tool('run_command', 'execute'),
  tool('web_search', 'network'), tool('load_skill', 'read'),
];

describe('CompatibilityToolPlatform', () => {
  it('publishes deferred exact aliases while retaining legacy tools', async () => {
    const platform = setup().platform;
    const tools = await platform.list('/workspace');
    expect(tools.map((item) => item.name)).toEqual(expect.arrayContaining(['read_file', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'PowerShell', 'WebSearch', 'Skill']));
    expect(tools.find((item) => item.name === 'Read')).toMatchObject({ deferLoading: true });
  });

  it('maps exact file, shell, search, and skill arguments to proven local tools', async () => {
    const fixture = setup();
    await fixture.platform.execute('Edit', { file_path: 'a.ts', old_string: 'a', new_string: 'b', replace_all: true }, '/workspace', 'workspace-write');
    await fixture.platform.execute('Bash', { command: 'npm test', timeout: 5_000, run_in_background: true }, '/workspace', 'workspace-write');
    await fixture.platform.execute('WebSearch', { query: 'docs', allowed_domains: ['a.test'] }, '/workspace', 'workspace-write');
    await fixture.platform.execute('Skill', { skill: 'review', args: 'focus tests' }, '/workspace', 'workspace-write');
    expect(fixture.execute).toHaveBeenNthCalledWith(1, 'apply_patch', { path: 'a.ts', oldText: 'a', newText: 'b', replaceAll: true }, '/workspace', 'workspace-write', undefined);
    expect(fixture.execute).toHaveBeenNthCalledWith(2, 'run_command', { command: 'npm test', timeoutMs: 5_000, description: undefined, run_in_background: true }, '/workspace', 'workspace-write', undefined);
    expect(fixture.execute).toHaveBeenNthCalledWith(3, 'web_search', { query: 'docs', domains: 'a.test' }, '/workspace', 'workspace-write', undefined);
    expect(fixture.execute).toHaveBeenNthCalledWith(4, 'load_skill', { skillId: 'review', args: 'focus tests' }, '/workspace', 'workspace-write', undefined);
  });

  it('selects native PowerShell execution and forwards multiline Grep explicitly', async () => {
    const fixture = setup();
    await fixture.platform.execute('PowerShell', { command: 'Get-ChildItem' }, '/workspace', 'danger-full-access');
    await fixture.platform.execute('Grep', { pattern: 'class.*method', multiline: true }, '/workspace', 'read-only');
    expect(fixture.execute).toHaveBeenNthCalledWith(1, 'run_command', expect.objectContaining({
      command: 'Get-ChildItem', shell: 'powershell',
    }), '/workspace', 'danger-full-access', undefined);
    expect(fixture.execute).toHaveBeenNthCalledWith(2, 'grep', expect.objectContaining({
      pattern: 'class.*method', multiline: true,
    }), '/workspace', 'read-only', undefined);
  });

  it('forwards PDF page ranges and preserves multimodal results without line-numbering metadata', async () => {
    const fixture = setup();
    fixture.execute.mockResolvedValueOnce({
      ok: true, output: 'PDF pages read', supplementalMessages: [{ role: 'user', content: [{ type: 'image_url' }] }],
    });
    await expect(fixture.platform.execute('Read', { file_path: 'a.pdf', pages: '1-2' }, '/workspace', 'workspace-write'))
      .resolves.toMatchObject({ ok: true, output: 'PDF pages read', supplementalMessages: [{ role: 'user' }] });
    expect(fixture.execute).toHaveBeenCalledWith('read_file', {
      path: 'a.pdf', offset: undefined, limit: undefined, pages: '1-2',
    }, '/workspace', 'workspace-write', undefined);
  });

  it('formats Read output with reference-style line numbers and maps Grep modes', async () => {
    const fixture = setup();
    fixture.execute.mockResolvedValueOnce({ ok: true, output: 'one\ntwo' });
    await expect(fixture.platform.execute('Read', { file_path: 'a.ts', offset: 3 }, '/workspace', 'workspace-write'))
      .resolves.toEqual({ ok: true, output: '     3→one\n     4→two' });
    await fixture.platform.execute('Grep', { pattern: 'TODO', output_mode: 'content', '-i': true, context: 2, head_limit: 10 }, '/workspace', 'workspace-write');
    expect(fixture.execute).toHaveBeenLastCalledWith('grep', expect.objectContaining({
      regex: true, caseSensitive: false, outputMode: 'content', contextBefore: 2, contextAfter: 2, maxResults: 10,
    }), '/workspace', 'workspace-write', undefined);
  });

  it('rejects conflicting WebSearch domain filters before network execution', async () => {
    const fixture = setup();
    await expect(fixture.platform.execute('WebSearch', {
      query: 'docs', allowed_domains: ['a.test'], blocked_domains: ['b.test'],
    }, '/workspace', 'workspace-write')).resolves.toEqual({ ok: false, output: expect.stringContaining('Cannot specify both') });
    expect(fixture.execute).not.toHaveBeenCalled();
  });
});

function setup() {
  const execute = vi.fn(async (): Promise<ToolResult> => ({ ok: true, output: 'ok' }));
  const base = { list: vi.fn(async () => definitions), execute };
  return { execute, platform: new CompatibilityToolPlatform(base, base) };
}
function tool(name: string, risk: AgentToolDefinition['risk']): AgentToolDefinition {
  return { name, risk, description: name, parameters: { type: 'object', properties: {} } };
}
