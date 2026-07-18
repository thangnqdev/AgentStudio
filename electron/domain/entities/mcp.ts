import type { ToolRisk } from './tool.js';

export type McpServerTransport =
  | { type: 'stdio'; command: string; args: string[] }
  | { type: 'http'; url: string };

export type McpServerConfig = {
  id: string;
  name: string;
  transport: McpServerTransport;
  autoStart: boolean;
  defaultRisk: ToolRisk;
  hasCredentials: boolean;
};

export type McpOAuthTokens = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

export type McpOAuthClientInformation = {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
};

export type McpInteractiveOAuthCredentials = {
  redirectUrl: string;
  tokens?: McpOAuthTokens;
  clientInformation?: McpOAuthClientInformation;
};

export type McpCredentials = {
  bearerToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthScope?: string;
  interactiveOAuth?: McpInteractiveOAuthCredentials;
  environment?: Record<string, string>;
};

export type McpServerRecord = McpServerConfig & { credentials: McpCredentials };

export type McpConnectionState = 'stopped' | 'starting' | 'connected' | 'needs-auth' | 'error';

export type McpServerStatus = McpServerConfig & {
  state: McpConnectionState;
  toolCount: number;
  error?: string;
};

export type SaveMcpServerInput = {
  id?: string;
  name: string;
  transport: McpServerTransport;
  autoStart?: boolean;
  defaultRisk?: ToolRisk;
  credentials?: McpCredentials;
  clearCredentials?: boolean;
};

export function toPublicMcpServerConfig(server: McpServerRecord): McpServerConfig {
  const { credentials: _credentials, ...config } = server;
  return config;
}
