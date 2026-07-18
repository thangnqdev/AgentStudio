import type { AgentTeamView } from '../../domain/entities/agentTeam';
import type { AgentWorkerStatus, AgentWorkerView } from '../../domain/entities/agentWorker';
import type { AgentAction } from '../../domain/entities/message';
import type { PermissionMode } from '../../domain/entities/settings';

export type AgentControlStatus = 'active' | 'idle' | 'paused' | 'completed' | 'failed' | 'killed';

export type AgentControlParticipant = {
  id: string;
  workerId?: string;
  name: string;
  role: 'lead' | 'teammate' | 'subagent';
  agentType: string;
  model?: string;
  permissionMode: PermissionMode;
  status: AgentControlStatus;
  description?: string;
  completedSteps?: number;
  background?: boolean;
  depth?: number;
  joinedAt: string;
  updatedAt: string;
  actions: AgentAction[];
  pendingAction?: AgentAction;
  resultPreview?: string;
  error?: string;
  worktreePath?: string;
  worktreeBranch?: string;
};

export type AgentControlActivity = {
  id: string;
  participantId?: string;
  agentName: string;
  kind: 'tool' | 'mailbox';
  title: string;
  detail?: string;
  status?: AgentAction['status'];
  createdAt: string;
};

export type AgentControlSnapshot = {
  participants: AgentControlParticipant[];
  activity: AgentControlActivity[];
  metrics: { total: number; working: number; idle: number; completed: number; attention: number };
};

export function buildAgentControlSnapshot(team: AgentTeamView | null, workers: AgentWorkerView[]): AgentControlSnapshot {
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const participants = team?.members.map((member) => {
    const worker = member.workerId ? workerById.get(member.workerId) : undefined;
    if (worker) workerById.delete(worker.id);
    const role = member.agentId === team.leadAgentId ? 'lead' as const : 'teammate' as const;
    return participant({
      id: member.agentId, worker, workerId: member.workerId, name: member.name, role,
      agentType: member.agentType ?? (role === 'lead' ? team.leadAgentType : 'general-purpose'),
      model: member.model, permissionMode: member.permissionMode, status: worker ? workerStatus(worker.status) : member.status,
      description: worker?.description ?? (role === 'lead' ? team.description : undefined),
      completedSteps: worker?.completedSteps ?? member.completedSteps, joinedAt: member.joinedAt,
      updatedAt: worker?.updatedAt ?? team.updatedAt,
    });
  }) ?? [];
  for (const worker of workerById.values()) {
    participants.push(participant({
      id: worker.id, worker, workerId: worker.id, name: worker.name || worker.description,
      role: 'subagent', agentType: worker.subagentType ?? 'general-purpose', model: worker.model,
      permissionMode: worker.permissionMode, status: workerStatus(worker.status), description: worker.description,
      completedSteps: worker.completedSteps, joinedAt: worker.createdAt, updatedAt: worker.updatedAt,
    }));
  }
  participants.sort((left, right) => roleRank(left.role) - roleRank(right.role)
    || statusRank(left.status) - statusRank(right.status) || left.joinedAt.localeCompare(right.joinedAt));
  const activity = buildActivity(team, participants);
  return {
    participants,
    activity,
    metrics: {
      total: participants.length,
      working: participants.filter((item) => item.status === 'active').length,
      idle: participants.filter((item) => item.status === 'idle' || item.status === 'paused').length,
      completed: participants.filter((item) => item.status === 'completed').length,
      attention: participants.filter((item) => item.status === 'failed' || item.pendingAction).length,
    },
  };
}

function participant(input: Omit<AgentControlParticipant, 'actions' | 'pendingAction' | 'background' | 'depth' | 'resultPreview' | 'error' | 'worktreePath' | 'worktreeBranch'> & { worker?: AgentWorkerView }): AgentControlParticipant {
  const { worker, ...base } = input;
  const actions = worker?.actions ?? [];
  const pendingAction = actions.find((action) => action.status === 'awaiting_approval');
  return {
    ...base, actions,
    ...(pendingAction ? { pendingAction } : {}),
    ...(worker?.background !== undefined ? { background: worker.background } : {}),
    ...(worker?.depth !== undefined ? { depth: worker.depth } : {}),
    ...(worker?.resultPreview ? { resultPreview: worker.resultPreview } : {}),
    ...(worker?.error ? { error: worker.error } : {}),
    ...(worker?.worktreePath ? { worktreePath: worker.worktreePath } : {}),
    ...(worker?.worktreeBranch ? { worktreeBranch: worker.worktreeBranch } : {}),
  };
}

function buildActivity(team: AgentTeamView | null, participants: AgentControlParticipant[]) {
  const participantByName = new Map(participants.map((item) => [item.name, item.id]));
  const mailbox: AgentControlActivity[] = (team?.recentMessages ?? []).map((message) => ({
    id: `mailbox:${message.id}`, participantId: participantByName.get(message.from), agentName: message.from,
    kind: 'mailbox', title: `${message.from} → ${message.to}`,
    detail: message.summary || mailboxLabel(message.kind), createdAt: message.createdAt,
  }));
  const tools: AgentControlActivity[] = participants.flatMap((item) => [...item.actions].reverse().map((action) => ({
    id: `tool:${item.id}:${action.id}`, participantId: item.id, agentName: item.name,
    kind: 'tool', title: action.toolName, detail: action.output || action.args,
    status: action.status, createdAt: item.updatedAt,
  })));
  return [...mailbox, ...tools].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 24);
}

function workerStatus(status: AgentWorkerStatus): AgentControlStatus {
  return status === 'running' ? 'active' : status;
}

function roleRank(role: AgentControlParticipant['role']) { return role === 'lead' ? 0 : role === 'teammate' ? 1 : 2; }
function statusRank(status: AgentControlStatus) { return status === 'active' ? 0 : status === 'paused' || status === 'idle' ? 1 : status === 'completed' ? 2 : 3; }
function mailboxLabel(kind: AgentTeamView['recentMessages'][number]['kind']) {
  return ({ message: 'Tin nhắn', task_assignment: 'Giao việc', shutdown_request: 'Yêu cầu dừng', shutdown_response: 'Phản hồi dừng', plan_approval_response: 'Duyệt kế hoạch' } as const)[kind];
}
