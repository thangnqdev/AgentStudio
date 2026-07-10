import type { PermissionMode } from './agent.js';

export type ToolRisk = 'read' | 'write' | 'execute' | 'network';

export type ToolParameter = {
  description: string;
  type: 'number' | 'string';
};

export type AgentToolDefinition = {
  name: string;
  description: string;
  risk: ToolRisk;
  parameters: {
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
};

export type ToolPolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
};

export type ToolApprovalRequest = {
  actionId: string;
  requestId: string;
  risk: ToolRisk;
  toolName: string;
  summary: string;
  workspaceRoot: string;
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

export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: 'list_files',
    description: 'List files and folders inside the current workspace.',
    risk: 'read',
    parameters: {
      properties: {
        dir: { type: 'string', description: 'Workspace-relative directory. Defaults to current workspace root.' },
        maxEntries: { type: 'number', description: 'Maximum entries to return.' },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Read a UTF-8 text file from the workspace.',
    risk: 'read',
    parameters: {
      properties: { path: { type: 'string', description: 'Workspace-relative file path.' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write UTF-8 text to a workspace file after user approval.',
    risk: 'write',
    parameters: {
      properties: {
        path: { type: 'string', description: 'Workspace-relative file path.' },
        content: { type: 'string', description: 'Full file content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_command',
    description: 'Run a shell command in the workspace after user approval.',
    risk: 'execute',
    parameters: {
      properties: {
        command: { type: 'string', description: 'Shell command to run.' },
        timeoutMs: { type: 'number', description: 'Timeout in milliseconds, max 30000.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the public web for current information through the configured OpenAI provider after user approval.',
    risk: 'network',
    parameters: {
      properties: {
        query: { type: 'string', description: 'Focused web search query.' },
        domains: { type: 'string', description: 'Optional comma-separated domains to restrict the search.' },
      },
      required: ['query'],
    },
  },
];

export function getAgentToolDefinition(toolName: string) {
  return AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === toolName);
}

export function evaluateToolPolicy(tool: AgentToolDefinition | undefined, permissionMode: PermissionMode): ToolPolicyDecision {
  if (!tool) return { allowed: false, requiresApproval: false, reason: 'Unknown tool.' };
  if (permissionMode === 'read-only' && tool.risk !== 'read') {
    return { allowed: false, requiresApproval: false, reason: `${tool.name} is blocked in read-only mode.` };
  }
  
  if (permissionMode === 'danger-full-access') {
    return { allowed: true, requiresApproval: false };
  }

  return { allowed: true, requiresApproval: tool.risk !== 'read' };
}
