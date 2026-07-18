import type { ChatMessage } from './agent.js';

export const AGENT_TEAM_PROTOCOL_VERSION = 1;
export const AGENT_TEAM_PROTOCOL_LEADER = 'team-lead';
export const MAX_AGENT_TEAM_PROTOCOL_MESSAGE_CHARACTERS = 150_000;

export type AgentTeamProtocolPermissionMode =
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'default'
  | 'dontAsk'
  | 'plan';

export type AgentTeamProtocolJson =
  | null
  | boolean
  | number
  | string
  | AgentTeamProtocolJson[]
  | { [key: string]: AgentTeamProtocolJson };

export type AgentTeamPermissionRequest = {
  type: 'permission_request'; request_id: string; agent_id: string; tool_name: string;
  tool_use_id: string; description: string; input: Record<string, AgentTeamProtocolJson>;
  permission_suggestions: AgentTeamProtocolJson[];
};

export type AgentTeamPermissionResponse =
  | { type: 'permission_response'; request_id: string; subtype: 'success'; response?: {
      updated_input?: Record<string, AgentTeamProtocolJson>;
      permission_updates?: AgentTeamProtocolJson[];
    } }
  | { type: 'permission_response'; request_id: string; subtype: 'error'; error: string };

export type AgentTeamSandboxPermissionRequest = {
  type: 'sandbox_permission_request'; requestId: string; workerId: string; workerName: string;
  workerColor?: string; hostPattern: { host: string }; createdAt: number;
};

export type AgentTeamSandboxPermissionResponse = {
  type: 'sandbox_permission_response'; requestId: string; host: string; allow: boolean; timestamp: string;
};

export type AgentTeamPlanApprovalRequest = {
  type: 'plan_approval_request'; from: string; timestamp: string; planFilePath: string;
  planContent: string; requestId: string;
};

export type AgentTeamPlanApprovalResponse = {
  type: 'plan_approval_response'; requestId: string; approved: boolean; feedback?: string;
  timestamp: string; permissionMode?: AgentTeamProtocolPermissionMode;
};

export type AgentTeamShutdownRequest = {
  type: 'shutdown_request'; requestId: string; from: string; reason?: string; timestamp: string;
};

export type AgentTeamShutdownApproved = {
  type: 'shutdown_approved'; requestId: string; from: string; timestamp: string;
  paneId?: string; backendType?: string;
};

export type AgentTeamShutdownRejected = {
  type: 'shutdown_rejected'; requestId: string; from: string; reason: string; timestamp: string;
};

export type AgentTeamIdleNotification = {
  type: 'idle_notification'; from: string; timestamp: string;
  idleReason?: 'available' | 'interrupted' | 'failed'; summary?: string; completedTaskId?: string;
  completedStatus?: 'resolved' | 'blocked' | 'failed'; failureReason?: string;
};

export type AgentTeamTaskAssignment = {
  type: 'task_assignment'; taskId: string; subject: string; description: string;
  assignedBy: string; timestamp: string;
};

export type AgentTeamPermissionUpdate = {
  type: 'team_permission_update';
  permissionUpdate: {
    type: 'addRules'; rules: Array<{ toolName: string; ruleContent?: string }>;
    behavior: 'allow' | 'deny' | 'ask'; destination: 'session';
  };
  directoryPath: string; toolName: string;
};

export type AgentTeamModeSetRequest = {
  type: 'mode_set_request'; mode: AgentTeamProtocolPermissionMode; from: string;
};

export type AgentTeamProtocolPayload =
  | { type: 'message'; text: string }
  | AgentTeamPermissionRequest | AgentTeamPermissionResponse
  | AgentTeamSandboxPermissionRequest | AgentTeamSandboxPermissionResponse
  | AgentTeamPlanApprovalRequest | AgentTeamPlanApprovalResponse
  | AgentTeamShutdownRequest | AgentTeamShutdownApproved | AgentTeamShutdownRejected
  | AgentTeamIdleNotification | AgentTeamTaskAssignment | AgentTeamPermissionUpdate
  | AgentTeamModeSetRequest;

export type AgentTeamProtocolMessage = {
  version: typeof AGENT_TEAM_PROTOCOL_VERSION;
  id: string;
  teamId: string;
  from: string;
  to: string;
  createdAt: string;
  color?: string;
  summary?: string;
  payload: AgentTeamProtocolPayload;
};

export type AgentTeamProtocolRole = 'leader' | 'teammate';

export type AgentTeamProtocolDelivery = {
  message: AgentTeamProtocolMessage;
  sequence: number;
};

export type AgentTeamPeerSummaryInput = Pick<ChatMessage, 'role' | 'content' | 'tool_calls'>;
