import { describe, expect, it, vi } from 'vitest';
import type { McpServerRecord } from '../../domain/entities/mcp.js';
import type { IMcpConnectionGateway } from '../../domain/ports/IMcpConnectionGateway.js';
import { ManageMcpServers } from './ManageMcpServers.js';

function createHarness(initial: McpServerRecord[] = []) {
  let records = [...initial];
  const gateway: IMcpConnectionGateway = {
    start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined), stopAll: vi.fn(async () => undefined),
    list: vi.fn(async () => []), execute: vi.fn(async () => ({ ok: false, output: '' })),
    getStatus: (config) => ({ ...config, state: 'stopped', toolCount: 0 }),
  };
  const manager = new ManageMcpServers({
    loadAll: async () => records,
    save: async (record) => { records = [...records.filter((item) => item.id !== record.id), record]; },
    remove: async (id) => { records = records.filter((item) => item.id !== id); },
  }, gateway);
  return { manager, gateway, records: () => records };
}

describe('ManageMcpServers', () => {
  it('rejects insecure non-local HTTP servers', async () => {
    const { manager } = createHarness();
    await expect(manager.save({ name: 'unsafe', transport: { type: 'http', url: 'http://example.com/mcp' } }, '/workspace'))
      .rejects.toThrow('require HTTPS');
  });

  it('preserves credentials when editing without a new credential payload', async () => {
    const existing: McpServerRecord = {
      id: 'server-1', name: 'server', transport: { type: 'stdio', command: 'node', args: ['server.js'] },
      autoStart: false, defaultRisk: 'execute', hasCredentials: true, credentials: { environment: { TOKEN: 'secret' } },
    };
    const { manager, records } = createHarness([existing]);
    await manager.save({ id: existing.id, name: 'renamed', transport: existing.transport }, '/workspace');
    expect(records()[0].credentials.environment).toEqual({ TOKEN: 'secret' });
    await manager.save({ id: existing.id, name: 'renamed', transport: existing.transport, clearCredentials: true }, '/workspace');
    expect(records()[0].credentials).toEqual({ bearerToken: undefined, oauthClientId: undefined, oauthClientSecret: undefined, oauthScope: undefined, environment: {} });
  });
});
