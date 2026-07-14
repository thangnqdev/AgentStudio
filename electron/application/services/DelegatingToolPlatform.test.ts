import { describe, expect, it, vi } from 'vitest';
import { DelegatingToolPlatform } from './DelegatingToolPlatform.js';

describe('DelegatingToolPlatform', () => {
  it('adds one local delegation tool and routes it to the subagent', async () => {
    const run = vi.fn(async () => ({ content: 'finding', role: 'review' as const, status: 'completed' as const, steps: 1 }));
    const platform = new DelegatingToolPlatform(
      { list: async () => [{ name: 'read_file', description: '', risk: 'read', parameters: {} }] },
      { execute: async () => ({ ok: true, output: 'base' }) },
      { run },
    );
    expect((await platform.list('/workspace')).map((tool) => tool.name)).toEqual(['read_file', 'delegate_task']);
    const result = await platform.execute('delegate_task', { prompt: 'Review this', role: 'review' }, '/workspace', 'workspace-write');
    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledWith({ prompt: 'Review this', role: 'review', workspaceRoot: '/workspace' });
  });

  it('does not expose internal subagent errors in tool output', async () => {
    const platform = new DelegatingToolPlatform(
      { list: async () => [] }, { execute: async () => ({ ok: true, output: '' }) },
      { run: async () => { throw new Error('secret provider URL'); } },
    );
    const result = await platform.execute('delegate_task', { prompt: 'Review' }, '/workspace', 'workspace-write');
    expect(result).toEqual({ ok: false, output: 'The read-only subagent failed before producing a result.' });
  });

  it('returns bounded validation feedback without invoking the subagent', async () => {
    const run = vi.fn();
    const platform = new DelegatingToolPlatform(
      { list: async () => [] }, { execute: async () => ({ ok: true, output: '' }) }, { run },
    );
    await expect(platform.execute('delegate_task', { prompt: '', role: 'explore' }, '/workspace', 'workspace-write')).resolves.toEqual({ ok: false, output: 'Subagent prompt is required.' });
    expect(run).not.toHaveBeenCalled();
  });
});
