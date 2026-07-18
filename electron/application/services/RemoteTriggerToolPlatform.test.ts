import { describe, expect, it, vi } from 'vitest';
import { RemoteTriggerToolPlatform } from './RemoteTriggerToolPlatform.js';

describe('RemoteTriggerToolPlatform', () => {
  it('advertises the deferred tool only after explicit opt-in and delegates exact calls', async () => {
    const execute = vi.fn(async () => ({ status: 200, json: '[]' }));
    const settings = { load: vi.fn(async () => ({ enabled: true, baseUrl: 'https://api.example.com', hasBearerToken: true })) };
    const base = { list: vi.fn(async () => []), execute: vi.fn() };
    const platform = new RemoteTriggerToolPlatform(base, base, { execute } as never, settings as never);
    await expect(platform.list('/workspace')).resolves.toMatchObject([{ name: 'RemoteTrigger', deferLoading: true }]);
    await expect(platform.execute('RemoteTrigger', { action: 'list' }, '/workspace', 'workspace-write')).resolves.toEqual({ ok: true, output: '{"status":200,"json":"[]"}' });
    expect(execute).toHaveBeenCalledWith({ action: 'list' }, undefined);
  });
});
