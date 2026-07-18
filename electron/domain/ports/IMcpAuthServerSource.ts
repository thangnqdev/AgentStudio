import type { McpAuthServer } from '../entities/mcpAuth.js';

export interface IMcpAuthServerSource {
  listAuthServers(): McpAuthServer[];
}
