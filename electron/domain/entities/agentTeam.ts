import type { PermissionMode } from './agent.js';
import type { AgentToolDefinition } from './tool.js';
import type { AgentWorkerStatus } from './agentWorker.js';

export const TEAM_CREATE_TOOL_NAME = 'TeamCreate';
export const TEAM_DELETE_TOOL_NAME = 'TeamDelete';
export const TEAM_LEAD_NAME = 'team-lead';
export const MAX_AGENT_TEAM_MEMBERS = 32;
export const MAX_AGENT_TEAM_MESSAGES = 1_000;
export const MAX_AGENT_TEAM_SHUTDOWN_REQUESTS = 100;

export type AgentTeamMember = {
  agentId: string;
  workerId?: string;
  name: string;
  agentType?: string;
  model?: string;
  permissionMode: PermissionMode;
  joinedAt: string;
};

export type AgentTeamMessageKind =
  | 'message'
  | 'task_assignment'
  | 'shutdown_request'
  | 'shutdown_response'
  | 'plan_approval_response';

export type AgentTeamMessage = {
  id: string;
  from: string;
  to: string;
  kind: AgentTeamMessageKind;
  content: string;
  summary?: string;
  createdAt: string;
  deliveredAt?: string;
};

export type AgentTeamShutdownRequest = {
  id: string;
  from: string;
  to: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  responseReason?: string;
  createdAt: string;
  respondedAt?: string;
};

export type AgentTeamRecord = {
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
  members: AgentTeamMember[];
  mailbox: AgentTeamMessage[];
  shutdownRequests: AgentTeamShutdownRequest[];
};

export type AgentTeamMemberView = AgentTeamMember & {
  status: 'active' | 'idle' | 'failed' | 'killed';
  completedSteps?: number;
};

export type AgentTeamView = Omit<AgentTeamRecord, 'mailbox' | 'shutdownRequests' | 'members'> & {
  members: AgentTeamMemberView[];
  recentMessages: Array<Pick<AgentTeamMessage, 'id' | 'from' | 'to' | 'kind' | 'summary' | 'createdAt'>>;
  pendingShutdowns: number;
};

export const TEAM_CREATE_TOOL_DEFINITION: AgentToolDefinition = {
  name: TEAM_CREATE_TOOL_NAME,
  description: 'Create one persistent team and shared task list for coordinating multiple agents.',
  risk: 'write', deferLoading: true, searchHint: 'create multi-agent swarm team',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      team_name: { type: 'string', description: 'Name for the new team.' },
      description: { type: 'string', description: 'Optional team purpose.' },
      agent_type: { type: 'string', description: 'Optional role/type for the team lead.' },
    },
    required: ['team_name'],
  },
};

export const TEAM_DELETE_TOOL_DEFINITION: AgentToolDefinition = {
  name: TEAM_DELETE_TOOL_NAME,
  description: 'Delete the current team and shared task list after every teammate has stopped.',
  risk: 'write', deferLoading: true, searchHint: 'delete shutdown agent team',
  parameters: { type: 'object', additionalProperties: false, properties: {} },
};

export function deriveTeamMemberStatus(status: AgentWorkerStatus | undefined): AgentTeamMemberView['status'] {
  if (status === 'running') return 'active';
  if (status === 'failed') return 'failed';
  if (status === 'killed') return 'killed';
  return 'idle';
}

export function summarizeAgentTeam(
  team: AgentTeamRecord,
  workerState: ReadonlyMap<string, { status: AgentWorkerStatus; completedSteps: number }> = new Map(),
): AgentTeamView {
  const { mailbox: _mailbox, shutdownRequests: _shutdownRequests, members: _members, ...summary } = structuredClone(team);
  return {
    ...summary,
    members: team.members.map((member) => {
      const worker = member.workerId ? workerState.get(member.workerId) : undefined;
      return {
        ...structuredClone(member),
        status: member.name === TEAM_LEAD_NAME ? 'active' : deriveTeamMemberStatus(worker?.status),
        ...(worker ? { completedSteps: worker.completedSteps } : {}),
      };
    }),
    recentMessages: team.mailbox.slice(-20).map(({ id, from, to, kind, summary, createdAt }) => ({
      id, from, to, kind, ...(summary ? { summary } : {}), createdAt,
    })),
    pendingShutdowns: team.shutdownRequests.filter((request) => request.status === 'pending').length,
  };
}
