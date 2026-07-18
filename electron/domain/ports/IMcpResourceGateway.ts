import type {
  McpRawResourceContent,
  McpResourceDescriptor,
  McpResourceServer,
} from '../entities/mcpResource.js';

export interface IMcpResourceGateway {
  listServers(): Promise<McpResourceServer[]>;
  listResources(serverId: string, signal?: AbortSignal): Promise<McpResourceDescriptor[]>;
  readResource(serverId: string, uri: string, signal?: AbortSignal): Promise<McpRawResourceContent[]>;
}
