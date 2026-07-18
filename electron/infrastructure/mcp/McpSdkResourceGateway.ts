import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import { MAX_MCP_RESOURCE_URI_CHARACTERS } from '../../domain/entities/mcpResource.js';
import type { IMcpResourceGateway } from '../../domain/ports/IMcpResourceGateway.js';
import type { McpConnectionSource } from './McpConnectionSource.js';
import type { McpResourceCache } from './McpResourceCache.js';

const MAX_NAME_CHARACTERS = 1_024;
const MAX_DESCRIPTION_CHARACTERS = 4_096;
const MAX_MIME_TYPE_CHARACTERS = 256;
const MAX_CONTENT_BLOCKS = 64;

export class McpSdkResourceGateway implements IMcpResourceGateway {
  private readonly connections: McpConnectionSource;
  private readonly cache: McpResourceCache;

  constructor(
    connections: McpConnectionSource,
    cache: McpResourceCache,
  ) { this.connections = connections; this.cache = cache; }

  async listServers() {
    return this.connections.listResourceServers();
  }

  async listResources(serverId: string, signal?: AbortSignal) {
    const connection = this.connectedResourceServer(serverId);
    let resources = this.cache.get(serverId);
    if (!resources) {
      const result = await connection.client.listResources(undefined, { timeout: 15_000, signal });
      this.cache.set(serverId, result.resources);
      resources = this.cache.get(serverId) ?? [];
    }
    return resources.flatMap((resource) => {
      const normalized = normalizeDescriptor(resource, connection.config.name);
      return normalized ? [normalized] : [];
    });
  }

  async readResource(serverId: string, uri: string, signal?: AbortSignal) {
    const connection = this.connectedResourceServer(serverId);
    const result = await connection.client.readResource(
      { uri },
      { timeout: 30_000, maxTotalTimeout: 60_000, signal },
    );
    if (result.contents.length > MAX_CONTENT_BLOCKS) throw new Error(`MCP resource returned more than ${MAX_CONTENT_BLOCKS} content blocks.`);
    return result.contents.map((content) => ({
      uri: content.uri,
      mimeType: content.mimeType,
      ...('text' in content ? { text: content.text } : { blob: content.blob }),
    }));
  }

  private connectedResourceServer(serverId: string) {
    const connection = this.connections.getConnection(serverId);
    if (!connection) throw new Error('MCP server is not connected.');
    if (!connection.capabilities.resources) throw new Error('MCP server does not support resources.');
    return connection;
  }
}

function normalizeDescriptor(resource: Resource, server: string) {
  if (!validUri(resource.uri)) return undefined;
  return {
    uri: resource.uri,
    name: clean(resource.name, MAX_NAME_CHARACTERS),
    ...(resource.mimeType ? { mimeType: clean(resource.mimeType, MAX_MIME_TYPE_CHARACTERS) } : {}),
    ...(resource.description ? { description: clean(resource.description, MAX_DESCRIPTION_CHARACTERS) } : {}),
    server,
  };
}

function validUri(uri: string) {
  return Boolean(uri) && uri.length <= MAX_MCP_RESOURCE_URI_CHARACTERS && ![...uri].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function clean(value: string, maximum: number) {
  return [...value].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('').slice(0, maximum);
}
