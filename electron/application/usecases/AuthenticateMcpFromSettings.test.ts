import { describe, expect, it, vi } from 'vitest';
import { AuthenticateMcpFromSettings } from './AuthenticateMcpFromSettings.js';

describe('AuthenticateMcpFromSettings', () => {
  it('opens only the authorization URL returned by the authentication boundary', async () => {
    const open = vi.fn(async () => undefined);
    const usecase = new AuthenticateMcpFromSettings({ authenticate: async () => ({
      status: 'auth_url', authUrl: 'https://auth.example/authorize', message: 'Authorize',
    }) }, { open });
    await expect(usecase.execute('server-1', '/workspace')).resolves.toMatchObject({ status: 'auth_url' });
    expect(open).toHaveBeenCalledWith('https://auth.example/authorize');
  });
});
