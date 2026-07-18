import type { McpResourceDescriptor } from '../../domain/entities/mcpResource.js';
import type { IMcpResourceGateway } from '../../domain/ports/IMcpResourceGateway.js';

export class ListMcpResources {
  private readonly gateway: IMcpResourceGateway;

  constructor(gateway: IMcpResourceGateway) { this.gateway = gateway; }

  async isAvailable() {
    return (await this.gateway.listServers()).some((server) => server.state === 'connected' && server.supportsResources);
  }

  async execute(input: { server?: unknown }, signal?: AbortSignal): Promise<McpResourceDescriptor[]> {
    const servers = await this.gateway.listServers();
    const target = input.server;
    if (target !== undefined && typeof target !== 'string') throw new Error('server must be a string.');
    const selected = typeof target === 'string' ? servers.filter((server) => server.name === target) : servers;
    if (typeof target === 'string' && selected.length === 0) {
      throw new Error(`Server "${target}" not found. Available servers: ${servers.map((server) => server.name).join(', ')}`);
    }
    const results = await Promise.all(selected.map(async (server) => {
      if (server.state !== 'connected' || !server.supportsResources) return [];
      try {
        return await this.gateway.listResources(server.id, signal);
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
        return [];
      }
    }));
    return results.flat();
  }
}
