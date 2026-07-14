import type { PermissionMode } from '../entities/agent.js';
import type { AgentToolDefinition, ToolPolicyDecision } from '../entities/tool.js';

export interface IToolPermissionPolicy {
  evaluate(input: {
    tool: AgentToolDefinition;
    permissionMode: PermissionMode;
    args: Record<string, unknown>;
    workspaceRoot: string;
  }): Promise<ToolPolicyDecision>;
}
