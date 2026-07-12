import type { AgentToolDefinition } from '../entities/tool.js';

export interface IToolCatalog {
  list(workspaceRoot: string): Promise<AgentToolDefinition[]>;
}
