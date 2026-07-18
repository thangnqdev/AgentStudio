import type { Resource } from '@modelcontextprotocol/sdk/types.js';

const MAX_RESOURCES_PER_SERVER = 500;

export class McpResourceCache {
  private readonly resources = new Map<string, Resource[]>();

  get(serverId: string) {
    const cached = this.resources.get(serverId);
    return cached ? [...cached] : undefined;
  }

  set(serverId: string, resources: readonly Resource[]) {
    this.resources.set(serverId, resources.slice(0, MAX_RESOURCES_PER_SERVER).map((resource) => structuredClone(resource)));
  }

  delete(serverId: string) {
    this.resources.delete(serverId);
  }
}
