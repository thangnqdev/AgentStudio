import type { PermissionMode } from './agent.js';

export type ToolRisk = 'read' | 'write' | 'execute' | 'network';

export type JsonSchema = Record<string, unknown>;

export type ToolSource =
  | { kind: 'local' }
  | { kind: 'mcp'; serverId: string; remoteToolName: string };

export type AgentToolDefinition = {
  name: string;
  description: string;
  risk: ToolRisk;
  readOnly?: boolean;
  concurrencySafe?: boolean;
  deferLoading?: boolean;
  alwaysLoad?: boolean;
  searchHint?: string;
  parameters: JsonSchema;
  source?: ToolSource;
};

export type ToolPolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  matchedRule?: {
    id: string;
    effect: 'allow' | 'ask' | 'deny';
    source: 'policy' | 'workspace' | 'user' | 'session';
  };
};

export type ToolApprovalRequest = {
  actionId: string;
  requestId: string;
  risk: ToolRisk;
  toolName: string;
  summary: string;
  workspaceRoot: string;
  domain?: string;
};

export type ToolAuditRecord = {
  actionId: string;
  outcome: 'approved' | 'denied' | 'error' | 'started' | 'succeeded';
  requestId: string;
  risk: ToolRisk;
  toolName: string;
  timestamp: string;
  workspaceRoot: string;
};

export function evaluateToolPolicy(tool: AgentToolDefinition | undefined, permissionMode: PermissionMode): ToolPolicyDecision {
  if (!tool) return { allowed: false, requiresApproval: false, reason: 'Unknown tool.' };
  if (permissionMode === 'read-only' && tool.risk !== 'read' && !tool.readOnly) {
    return { allowed: false, requiresApproval: false, reason: `${tool.name} is blocked in read-only mode.` };
  }
  
  if (permissionMode === 'danger-full-access') {
    return { allowed: true, requiresApproval: false };
  }

  return { allowed: true, requiresApproval: tool.risk !== 'read' };
}
