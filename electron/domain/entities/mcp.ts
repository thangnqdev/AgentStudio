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

export type McpCredentials = {
  bearerToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthScope?: string;
  environment?: Record<string, string>;
};

export type McpServerRecord = McpServerConfig & { credentials: McpCredentials };

export type McpConnectionState = 'stopped' | 'starting' | 'connected' | 'error';

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
