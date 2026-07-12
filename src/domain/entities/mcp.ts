export type McpToolRisk = 'read' | 'write' | 'execute' | 'network';

export type McpServerTransport =
  | { type: 'stdio'; command: string; args: string[] }
  | { type: 'http'; url: string };

export type McpServerStatus = {
  id: string;
  name: string;
  transport: McpServerTransport;
  autoStart: boolean;
  defaultRisk: McpToolRisk;
  hasCredentials: boolean;
  state: 'stopped' | 'starting' | 'connected' | 'error';
  toolCount: number;
  error?: string;
};

export type SaveMcpServerPayload = {
  id?: string;
  name: string;
  transport: McpServerTransport;
  autoStart?: boolean;
  defaultRisk?: McpToolRisk;
  credentials?: {
    bearerToken?: string;
    oauthClientId?: string;
    oauthClientSecret?: string;
    oauthScope?: string;
    environment?: Record<string, string>;
  };
  clearCredentials?: boolean;
};
