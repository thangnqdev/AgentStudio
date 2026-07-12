import type { McpServerRecord } from '../entities/mcp.js';

export interface IMcpServerRepository {
  loadAll(): Promise<McpServerRecord[]>;
  save(server: McpServerRecord): Promise<void>;
  remove(serverId: string): Promise<void>;
}
