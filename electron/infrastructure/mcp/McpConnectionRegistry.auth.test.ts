import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { McpConnectionRegistry } from './McpConnectionRegistry.js';
import { McpResourceCache } from './McpResourceCache.js';

const closeHandlers: Array<() => Promise<void>> = [];
afterEach(async () => { await Promise.all(closeHandlers.splice(0).map((close) => close())); });

describe('McpConnectionRegistry authentication state', () => {
  it('turns an HTTP 401 into needs-auth without exposing the challenge', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(401, { 'WWW-Authenticate': 'Bearer realm="private-realm"' });
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    closeHandlers.push(() => new Promise((resolve) => server.close(() => resolve())));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;
    const registry = new McpConnectionRegistry(new McpResourceCache());
    const config = {
      id: 'auth-server', name: 'private docs', transport: { type: 'http' as const, url },
      autoStart: false, defaultRisk: 'read' as const, hasCredentials: false,
    };
    await expect(registry.start(config, {}, '/workspace')).resolves.toBeUndefined();
    expect(registry.getStatus(config)).toMatchObject({ state: 'needs-auth', toolCount: 0 });
    expect(registry.listAuthServers()).toEqual([expect.objectContaining({ id: config.id, state: 'needs-auth', transport: 'http' })]);
  });
});
