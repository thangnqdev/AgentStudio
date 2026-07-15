import type { AgentActionPayload, ChatMessage, Message, PermissionMode } from './agent.js';
import type { AgentToolDefinition } from './tool.js';

export const AGENT_WORKER_TOOL_NAME = 'Agent';
export const SEND_MESSAGE_TOOL_NAME = 'SendMessage';
export const MAX_AGENT_WORKER_DEPTH = 3;
export const MAX_AGENT_WORKER_PROMPT_CHARACTERS = 40_000;
export const MAX_AGENT_WORKER_MESSAGE_CHARACTERS = 20_000;
export const AGENT_WORKER_MODELS = ['sonnet', 'opus', 'haiku'] as const;

export type AgentWorkerStatus = 'running' | 'paused' | 'completed' | 'failed' | 'killed';
export type AgentWorkerIsolation = 'worktree';
export type AgentWorkerModel = typeof AGENT_WORKER_MODELS[number];

export type AgentWorkerSpawnRequest = {
  description: string;
  prompt: string;
  subagentType?: string;
  model?: AgentWorkerModel;
  runInBackground: boolean;
  name?: string;
  teamName?: string;
  mode?: PermissionMode;
  isolation?: AgentWorkerIsolation;
  cwd?: string;
};

export type AgentWorkerRecord = {
  id: string;
  traceId: string;
  parentScopeId: string;
  parentAgentId?: string;
  name?: string;
  teamName?: string;
  description: string;
  prompt: string;
  subagentType?: string;
  model?: AgentWorkerModel;
  permissionMode: PermissionMode;
  isolation?: AgentWorkerIsolation;
  cwd?: string;
  workspaceRoot: string;
  depth: number;
  background: boolean;
  status: AgentWorkerStatus;
  createdAt: string;
  updatedAt: string;
  completedSteps: number;
  messages: Message[];
  conversation: ChatMessage[];
  result?: string;
  error?: string;
  worktreePath?: string;
  worktreeBranch?: string;
};

export type AgentWorkerCheckpoint = Pick<AgentWorkerRecord,
  'id' | 'status' | 'updatedAt' | 'completedSteps' | 'messages' | 'conversation' | 'result' | 'error' | 'worktreePath' | 'worktreeBranch'>;

export type AgentWorkerSummary = Omit<AgentWorkerRecord, 'messages' | 'conversation' | 'prompt'> & {
  resultPreview?: string;
};

export type AgentWorkerNotification = {
  id: string;
  parentScopeId: string;
  agentId: string;
  agentName?: string;
  status: Extract<AgentWorkerStatus, 'completed' | 'failed' | 'killed' | 'paused'>;
  message: string;
  createdAt: string;
};

export type AgentWorkerEvent = {
  scopeId: string;
  worker: AgentWorkerSummary;
  action?: AgentActionPayload;
};

export type SendMessageRequest = {
  to: string;
  summary?: string;
  message: string | AgentWorkerStructuredMessage;
};

export type AgentWorkerStructuredMessage =
  | { type: 'shutdown_request'; reason?: string }
  | { type: 'shutdown_response'; request_id: string; approve: boolean; reason?: string }
  | { type: 'plan_approval_response'; request_id: string; approve: boolean; feedback?: string };

export const AGENT_WORKER_TOOL_DEFINITION: AgentToolDefinition = {
  name: AGENT_WORKER_TOOL_NAME,
  description: 'Launch a full-capability agent for a delegated task. It may run in the background, receive messages, and use an isolated worktree.',
  risk: 'network',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      description: { type: 'string', description: 'A short 3-5 word description of the task.' },
      prompt: { type: 'string', description: 'The task for the agent to perform.' },
      subagent_type: { type: 'string', description: 'Optional trusted specialized agent profile id.' },
      model: { type: 'string', enum: [...AGENT_WORKER_MODELS], description: 'Optional model override.' },
      run_in_background: { type: 'boolean', description: 'Return immediately and notify this conversation when the agent finishes.' },
      name: { type: 'string', description: 'Addressable agent name for SendMessage.' },
      team_name: { type: 'string', description: 'Optional team name.' },
      mode: { type: 'string', enum: ['read-only', 'workspace-write', 'danger-full-access'], description: 'Child permission mode; cannot exceed the parent mode.' },
      isolation: { type: 'string', enum: ['worktree'], description: 'Create a temporary managed Git worktree for this agent.' },
      cwd: { type: 'string', description: 'Absolute working directory. Mutually exclusive with isolation.' },
    },
    required: ['description', 'prompt'],
  },
};

export const SEND_MESSAGE_TOOL_DEFINITION: AgentToolDefinition = {
  name: SEND_MESSAGE_TOOL_NAME,
  description: 'Send a message to a named or identified agent, broadcast to all agents in this scope, or request a graceful shutdown.',
  risk: 'network',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      to: { type: 'string', description: 'Agent name/id, or * to broadcast.' },
      summary: { type: 'string', description: 'Required 5-10 word preview for plain text messages.' },
      message: {
        description: 'Plain text or a structured shutdown/approval response.',
        anyOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['shutdown_request', 'shutdown_response', 'plan_approval_response'] },
              request_id: { type: 'string' }, approve: { type: 'boolean' },
              reason: { type: 'string' }, feedback: { type: 'string' },
            },
            required: ['type'],
          },
        ],
      },
    },
    required: ['to', 'message'],
  },
};

export function summarizeAgentWorker(worker: AgentWorkerRecord): AgentWorkerSummary {
  const { messages: _messages, conversation: _conversation, prompt: _prompt, result, ...summary } = worker;
  return { ...structuredClone(summary), ...(result ? { resultPreview: result.slice(0, 1_000) } : {}) };
}

export function resolveChildPermissionMode(parent: PermissionMode, requested?: PermissionMode): PermissionMode {
  const mode = requested ?? parent;
  const rank: Record<PermissionMode, number> = { 'read-only': 0, 'workspace-write': 1, 'danger-full-access': 2 };
  if (rank[mode] > rank[parent]) throw new Error('Agent permission mode cannot exceed the parent permission mode.');
  return mode;
}
