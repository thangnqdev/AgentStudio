import type {
  McpInteractiveOAuthCredentials,
  McpOAuthClientInformation,
  McpOAuthTokens,
} from '../entities/mcp.js';

export interface IMcpOAuthCredentialStore {
  load(serverId: string): Promise<McpInteractiveOAuthCredentials | undefined>;
  saveClientInformation(serverId: string, redirectUrl: string, information: McpOAuthClientInformation): Promise<void>;
  saveTokens(serverId: string, redirectUrl: string, tokens: McpOAuthTokens): Promise<void>;
  clear(serverId: string, scope: 'all' | 'client' | 'tokens'): Promise<void>;
}
