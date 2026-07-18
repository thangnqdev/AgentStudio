import type { McpAuthOutput } from '../entities/mcpAuth.js';

export interface IMcpAuthenticationGateway {
  authenticate(serverId: string, workspaceRoot: string): Promise<McpAuthOutput>;
}
