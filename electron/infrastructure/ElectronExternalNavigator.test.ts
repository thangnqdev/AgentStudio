import { beforeEach, describe, expect, it, vi } from 'vitest';

const openExternal = vi.fn(async () => undefined);
vi.mock('electron', () => ({ shell: { openExternal } }));

describe('ElectronExternalNavigator', () => {
  beforeEach(() => openExternal.mockClear());

  it('opens explicit HTTPS authorization URLs and rejects unsafe schemes or userinfo', async () => {
    const { ElectronExternalNavigator } = await import('./ElectronExternalNavigator.js');
    const navigator = new ElectronExternalNavigator();
    await navigator.open('https://auth.example/authorize?client_id=agentstudio');
    expect(openExternal).toHaveBeenCalledWith('https://auth.example/authorize?client_id=agentstudio');
    await expect(navigator.open('http://auth.example/authorize')).rejects.toThrow('HTTPS');
    await expect(navigator.open('https://user:pass@auth.example/authorize')).rejects.toThrow('userinfo');
  });
});
