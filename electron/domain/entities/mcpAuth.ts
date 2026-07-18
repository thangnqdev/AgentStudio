import type { McpConnectionState } from './mcp.js';
import type { AgentToolDefinition } from './tool.js';

export type McpAuthServer = {
  id: string;
  name: string;
  state: McpConnectionState;
  transport: 'stdio' | 'http';
  url?: string;
};

export type McpAuthOutput = {
  status: 'auth_url' | 'unsupported' | 'error';
  message: string;
  authUrl?: string;
};

export function buildMcpAuthToolName(serverName: string) {
  const normalized = serverName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 45) || 'server';
  return `mcp__${normalized}__authenticate`;
}

export function buildMcpAuthToolDefinition(server: McpAuthServer): AgentToolDefinition {
  const location = server.url ? `http at ${server.url}` : server.transport;
  return {
    name: buildMcpAuthToolName(server.name),
    description: [
      `The ${server.name} MCP server (${location}) is installed but requires authentication.`,
      'Call this tool to start its OAuth flow and receive an authorization URL to share with the user.',
      'After the user completes authorization, the server reconnects and its real tools become available automatically.',
    ].join(' '),
    risk: 'network', readOnly: false, concurrencySafe: false, deferLoading: true,
    searchHint: `authenticate OAuth for the ${server.name} MCP server`,
    parameters: { type: 'object', additionalProperties: false, properties: {} },
  };
}
