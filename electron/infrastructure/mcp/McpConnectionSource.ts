import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import type { McpServerConfig } from '../../domain/entities/mcp.js';
import type { McpResourceServer } from '../../domain/entities/mcpResource.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';

export type McpRemoteTool = {
  canonicalName: string;
  remoteName: string;
  definition: AgentToolDefinition;
};

export type McpSdkConnection = {
  client: Client;
  config: McpServerConfig;
  capabilities: ServerCapabilities;
  tools: Map<string, McpRemoteTool>;
};

export interface McpConnectionSource {
  getConnection(serverId: string): McpSdkConnection | undefined;
  listConnections(): McpSdkConnection[];
  listResourceServers(): McpResourceServer[];
}
