import { describe, expect, it, vi } from 'vitest';
import type { McpInteractiveOAuthCredentials } from '../../domain/entities/mcp.js';
import type { IMcpOAuthCredentialStore } from '../../domain/ports/IMcpOAuthCredentialStore.js';
import { LoopbackMcpAuthSessionGateway } from './LoopbackMcpAuthSessionGateway.js';

function createStore() {
  let value: McpInteractiveOAuthCredentials | undefined;
  const store: IMcpOAuthCredentialStore = {
    load: vi.fn(async () => value),
    saveClientInformation: vi.fn(async (_id, redirectUrl, clientInformation) => {
      value = { ...value, redirectUrl, clientInformation };
    }),
    saveTokens: vi.fn(async (_id, redirectUrl, tokens) => { value = { ...value, redirectUrl, tokens }; }),
    clear: vi.fn(async () => { value = undefined; }),
  };
  return { store, read: () => value };
}

function createDriver() {
  return vi.fn(async (provider, input: { serverUrl: string; authorizationCode?: string }) => {
    if (!input.authorizationCode) {
      await provider.saveCodeVerifier('a'.repeat(64));
      await provider.saveClientInformation?.({ client_id: 'public-client' });
      const url = new URL('https://auth.example.test/authorize');
      url.searchParams.set('state', String(await provider.state?.()));
      url.searchParams.set('redirect_uri', String(provider.redirectUrl));
      await provider.redirectToAuthorization(url);
      return 'REDIRECT' as const;
    }
    expect(input.authorizationCode).toBe('authorization-code');
    expect(await provider.codeVerifier()).toBe('a'.repeat(64));
    await provider.saveTokens({ access_token: 'private-access-token', token_type: 'Bearer', refresh_token: 'private-refresh-token' });
    return 'AUTHORIZED' as const;
  });
}

describe('LoopbackMcpAuthSessionGateway', () => {
  it('validates state, completes PKCE on loopback, and keeps tokens out of responses', async () => {
    const credentials = createStore();
    const gateway = new LoopbackMcpAuthSessionGateway(credentials.store, createDriver(), 5_000);
    const session = await gateway.begin({ serverId: 'one', serverName: 'docs', serverUrl: 'https://mcp.example.test/' });
    const authorization = new URL(session.authorizationUrl!);
    const callback = new URL(authorization.searchParams.get('redirect_uri')!);
    callback.searchParams.set('state', authorization.searchParams.get('state')!);
    callback.searchParams.set('code', 'authorization-code');
    const response = await fetch(callback);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toMatch(/private-access-token|private-refresh-token/);
    await expect(session.completion).resolves.toBeUndefined();
    expect(credentials.read()?.tokens).toMatchObject({ access_token: 'private-access-token' });
  });

  it('rejects a forged state and does not exchange its code', async () => {
    const credentials = createStore();
    const driver = createDriver();
    const gateway = new LoopbackMcpAuthSessionGateway(credentials.store, driver, 5_000);
    const session = await gateway.begin({ serverId: 'two', serverName: 'docs', serverUrl: 'https://mcp.example.test/' });
    const authorization = new URL(session.authorizationUrl!);
    const callback = new URL(authorization.searchParams.get('redirect_uri')!);
    callback.searchParams.set('state', 'forged-state');
    callback.searchParams.set('code', 'authorization-code');
    expect((await fetch(callback)).status).toBe(400);
    expect(driver).toHaveBeenCalledTimes(1);
    await gateway.cancel('two');
    await expect(session.completion).rejects.toThrow('cancelled');
    expect(credentials.read()?.tokens).toBeUndefined();
  });
});
