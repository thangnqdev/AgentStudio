import type { PermissionMode } from './settings';

export type AgentTeamMemberView = {
  agentId: string;
  workerId?: string;
  name: string;
  agentType?: string;
  model?: string;
  permissionMode: PermissionMode;
  joinedAt: string;
  status: 'active' | 'idle' | 'failed' | 'killed';
  completedSteps?: number;
};

export type AgentTeamView = {
  version: 1;
  id: string;
  scopeId: string;
  name: string;
  taskListId: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  leadAgentId: string;
  leadAgentType: string;
  members: AgentTeamMemberView[];
  recentMessages: Array<{
    id: string;
    from: string;
    to: string;
    kind: 'message' | 'task_assignment' | 'shutdown_request' | 'shutdown_response' | 'plan_approval_response';
    summary?: string;
    createdAt: string;
  }>;
  pendingShutdowns: number;
};

export type AgentTeamEvent = { scopeId: string; team: AgentTeamView | null };
