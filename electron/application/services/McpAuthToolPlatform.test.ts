import { describe, expect, it, vi } from 'vitest';
import { buildMcpAuthToolName, type McpAuthServer } from '../../domain/entities/mcpAuth.js';
import type { IMcpAuthSessionGateway } from '../../domain/ports/IMcpAuthSessionGateway.js';
import type { IMcpConnectionGateway } from '../../domain/ports/IMcpConnectionGateway.js';
import type { IMcpServerRepository } from '../../domain/ports/IMcpServerRepository.js';
import { BeginMcpAuthentication } from '../usecases/BeginMcpAuthentication.js';
import { McpAuthToolPlatform } from './McpAuthToolPlatform.js';

const record = {
  id: 'server-1', name: 'secure docs', transport: { type: 'http' as const, url: 'https://mcp.example.test/' },
  autoStart: false, defaultRisk: 'read' as const, hasCredentials: false, credentials: { oauthScope: 'docs:read' },
};

function createHarness(begin: IMcpAuthSessionGateway['begin'] = vi.fn(async () => ({
  status: 'authorization_required' as const,
  authorizationUrl: 'https://auth.example.test/authorize?state=public-state',
  completion: Promise.resolve(),
}))) {
  const servers: McpAuthServer[] = [{
    id: record.id, name: record.name, state: 'needs-auth', transport: 'http', url: record.transport.url,
  }];
  const repository: IMcpServerRepository = {
    loadAll: vi.fn(async () => [record]), save: vi.fn(async () => undefined), remove: vi.fn(async () => undefined),
  };
  const connections: IMcpConnectionGateway = {
    start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined), forget: vi.fn(async () => undefined),
    stopAll: vi.fn(async () => undefined), getStatus: vi.fn((config) => ({ ...config, state: 'needs-auth', toolCount: 0 })),
    list: vi.fn(async () => []), execute: vi.fn(async () => ({ ok: false, output: 'base' })),
  };
  const sessions: IMcpAuthSessionGateway = {
    begin, cancel: vi.fn(async () => undefined), cancelAll: vi.fn(async () => undefined),
  };
  const base = { list: vi.fn(async () => []), execute: vi.fn(async () => ({ ok: false, output: 'base' })) };
  const platform = new McpAuthToolPlatform(
    base, base, { listAuthServers: () => servers }, new BeginMcpAuthentication(sessions, repository, connections),
  );
  return { platform, sessions, connections, servers };
}

describe('McpAuthToolPlatform', () => {
  it('exposes one deferred network authenticate tool only for needs-auth servers', async () => {
    const { platform, servers } = createHarness();
    const [tool] = await platform.list('/workspace');
    expect(tool).toMatchObject({
      name: 'mcp__secure_docs__authenticate', risk: 'network', readOnly: false,
      concurrencySafe: false, deferLoading: true,
      parameters: { type: 'object', additionalProperties: false, properties: {} },
    });
    servers[0].state = 'stopped';
    expect(await platform.list('/workspace')).toEqual([]);
  });

  it('returns only the authorization URL and reconnects after background completion', async () => {
    const { platform, sessions, connections } = createHarness();
    const result = await platform.execute(buildMcpAuthToolName(record.name), {}, '/workspace', 'workspace-write');
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.output)).toEqual({
      status: 'auth_url', authUrl: 'https://auth.example.test/authorize?state=public-state',
      message: expect.stringContaining('open this URL'),
    });
    expect(result.output).not.toMatch(/access_token|refresh_token|secret/i);
    expect(sessions.begin).toHaveBeenCalledWith(expect.objectContaining({ serverId: record.id, scope: 'docs:read' }));
    await vi.waitFor(() => expect(connections.start).toHaveBeenCalledOnce());
  });

  it('redacts infrastructure errors from model output', async () => {
    const { platform } = createHarness(vi.fn(async () => { throw new Error('refresh_token=private-secret'); }));
    const result = await platform.execute(buildMcpAuthToolName(record.name), {}, '/workspace', 'workspace-write');
    expect(JSON.parse(result.output)).toMatchObject({ status: 'error' });
    expect(result.output).not.toContain('private-secret');
  });
});
