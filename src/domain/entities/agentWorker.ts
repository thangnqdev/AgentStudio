import type { AgentAction } from './message';
import type { PermissionMode } from './settings';

export type AgentWorkerStatus = 'running' | 'paused' | 'completed' | 'failed' | 'killed';

export type AgentWorkerSummary = {
  id: string;
  traceId: string;
  parentScopeId: string;
  parentAgentId?: string;
  name?: string;
  teamName?: string;
  description: string;
  subagentType?: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  permissionMode: PermissionMode;
  isolation?: 'worktree';
  cwd?: string;
  workspaceRoot: string;
  depth: number;
  background: boolean;
  status: AgentWorkerStatus;
  createdAt: string;
  updatedAt: string;
  completedSteps: number;
  resultPreview?: string;
  error?: string;
  worktreePath?: string;
  worktreeBranch?: string;
};

export type AgentWorkerEvent = {
  scopeId: string;
  worker: AgentWorkerSummary;
  action?: Omit<AgentAction, 'requestId'>;
};

export type AgentWorkerView = AgentWorkerSummary & { actions: AgentAction[] };
