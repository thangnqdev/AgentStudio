export type McpAuthSession = {
  status: 'authorization_required' | 'completed';
  authorizationUrl?: string;
  completion: Promise<void>;
};

export interface IMcpAuthSessionGateway {
  begin(input: { serverId: string; serverName: string; serverUrl: string; scope?: string }): Promise<McpAuthSession>;
  cancel(serverId: string): Promise<void>;
  cancelAll(): Promise<void>;
}
