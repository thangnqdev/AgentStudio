import type { McpCredentials, McpServerConfig, McpServerStatus } from '../entities/mcp.js';
import type { IToolCatalog } from './IToolCatalog.js';
import type { IToolExecutor } from './IToolExecutor.js';

export interface IMcpConnectionGateway extends IToolCatalog, IToolExecutor {
  start(config: McpServerConfig, credentials: McpCredentials, workspaceRoot: string): Promise<void>;
  stop(serverId: string): Promise<void>;
  stopAll(): Promise<void>;
  getStatus(config: McpServerConfig): McpServerStatus;
}
