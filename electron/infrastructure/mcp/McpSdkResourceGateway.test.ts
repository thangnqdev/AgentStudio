import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, describe, expect, it } from 'vitest';
import type { McpServerConfig } from '../../domain/entities/mcp.js';
import type { McpConnectionSource, McpSdkConnection } from './McpConnectionSource.js';
import { McpResourceCache } from './McpResourceCache.js';
import { McpSdkResourceGateway } from './McpSdkResourceGateway.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function createHarness() {
  const server = new McpServer({ name: 'resource-server', version: '1.0.0' });
  server.registerResource('Guide', 'docs://guide', {
    description: 'A guide', mimeType: 'text/plain',
  }, async () => ({ contents: [{ uri: 'docs://guide', mimeType: 'text/plain', text: 'hello from MCP' }] }));
  server.registerResource('Logo', 'docs://logo', {
    description: 'A logo', mimeType: 'image/png',
  }, async () => ({ contents: [{ uri: 'docs://logo', mimeType: 'image/png', blob: 'YWJj' }] }));

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'agent-studio-test', version: '1.0.0' }, { capabilities: {} });
  await client.connect(clientTransport);
  cleanups.push(async () => { await client.close().catch(() => undefined); await server.close().catch(() => undefined); });

  const config: McpServerConfig = {
    id: 'server-1', name: 'docs', transport: { type: 'http', url: 'https://example.com/mcp' },
    autoStart: true, defaultRisk: 'read', hasCredentials: false,
  };
  const connection: McpSdkConnection = {
    client, config, capabilities: client.getServerCapabilities() ?? {}, tools: new Map(),
  };
  const source: McpConnectionSource = {
    getConnection: (id) => id === config.id ? connection : undefined,
    listConnections: () => [connection],
    listResourceServers: () => [{ id: config.id, name: config.name, state: 'connected', supportsResources: true }],
  };
  return new McpSdkResourceGateway(source, new McpResourceCache());
}

describe('McpSdkResourceGateway', () => {
  it('uses the real SDK resources/list and resources/read paths', async () => {
    const gateway = await createHarness();
    expect(await gateway.listResources('server-1')).toEqual([
      { uri: 'docs://guide', name: 'Guide', mimeType: 'text/plain', description: 'A guide', server: 'docs' },
      { uri: 'docs://logo', name: 'Logo', mimeType: 'image/png', description: 'A logo', server: 'docs' },
    ]);
    expect(await gateway.readResource('server-1', 'docs://guide')).toEqual([
      { uri: 'docs://guide', mimeType: 'text/plain', text: 'hello from MCP' },
    ]);
    expect(await gateway.readResource('server-1', 'docs://logo')).toEqual([
      { uri: 'docs://logo', mimeType: 'image/png', blob: 'YWJj' },
    ]);
  });
});
