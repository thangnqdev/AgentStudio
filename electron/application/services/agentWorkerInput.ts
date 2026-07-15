import type { PermissionMode } from '../../domain/entities/agent.js';
import {
  AGENT_WORKER_MODELS,
  MAX_AGENT_WORKER_MESSAGE_CHARACTERS,
  MAX_AGENT_WORKER_PROMPT_CHARACTERS,
  type AgentWorkerSpawnRequest,
  type AgentWorkerStructuredMessage,
  type SendMessageRequest,
} from '../../domain/entities/agentWorker.js';

const PERMISSION_MODES: PermissionMode[] = ['read-only', 'workspace-write', 'danger-full-access'];
const AGENT_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export function parseAgentWorkerSpawnRequest(args: Record<string, unknown>): AgentWorkerSpawnRequest {
  assertOnlyKeys(args, ['description', 'prompt', 'subagent_type', 'model', 'run_in_background', 'name', 'team_name', 'mode', 'isolation', 'cwd']);
  const description = requiredString(args.description, 200, 'Agent description is required.');
  const prompt = requiredString(args.prompt, MAX_AGENT_WORKER_PROMPT_CHARACTERS, 'Agent prompt is required.');
  const subagentType = optionalIdentifier(args.subagent_type, 'Agent subagent_type is invalid.');
  const model = optionalEnum(args.model, AGENT_WORKER_MODELS, 'Agent model is invalid.');
  const name = optionalName(args.name, 'Agent name is invalid.');
  const teamName = optionalName(args.team_name, 'Agent team_name is invalid.');
  const mode = optionalEnum(args.mode, PERMISSION_MODES, 'Agent mode is invalid.');
  if (args.run_in_background !== undefined && typeof args.run_in_background !== 'boolean') throw new Error('Agent run_in_background must be a boolean.');
  if (args.isolation !== undefined && args.isolation !== 'worktree') throw new Error('Agent isolation must be worktree.');
  const cwd = optionalString(args.cwd, 4_096, 'Agent cwd is invalid.');
  if (cwd && args.isolation === 'worktree') throw new Error('Agent cwd and isolation are mutually exclusive.');
  return {
    description, prompt, runInBackground: args.run_in_background === true,
    ...(subagentType ? { subagentType } : {}), ...(model ? { model } : {}),
    ...(name ? { name } : {}), ...(teamName ? { teamName } : {}), ...(mode ? { mode } : {}),
    ...(args.isolation === 'worktree' ? { isolation: 'worktree' as const } : {}), ...(cwd ? { cwd } : {}),
  };
}

export function parseSendMessageRequest(args: Record<string, unknown>): SendMessageRequest {
  assertOnlyKeys(args, ['to', 'summary', 'message']);
  const to = requiredString(args.to, 128, 'SendMessage recipient is required.');
  if (to !== '*' && to !== 'parent' && !AGENT_NAME.test(to)) throw new Error('SendMessage recipient is invalid. Do not prefix names with @.');
  const summary = optionalString(args.summary, 160, 'SendMessage summary is invalid.');
  const message = typeof args.message === 'string'
    ? requiredString(args.message, MAX_AGENT_WORKER_MESSAGE_CHARACTERS, 'SendMessage message is required.')
    : parseStructuredMessage(args.message);
  if (typeof message === 'string') {
    const words = summary?.split(/\s+/).filter(Boolean).length ?? 0;
    if (words < 5 || words > 10) throw new Error('SendMessage summary must contain 5-10 words for a plain text message.');
  } else if (to === '*') {
    throw new Error('Structured SendMessage messages cannot be broadcast.');
  }
  return { to, message, ...(summary ? { summary } : {}) };
}

function parseStructuredMessage(value: unknown): AgentWorkerStructuredMessage {
  if (!isObject(value) || typeof value.type !== 'string') throw new Error('SendMessage message must be text or a supported structured message.');
  if (value.type === 'shutdown_request') {
    assertOnlyKeys(value, ['type', 'reason']);
    return { type: value.type, ...(optionalString(value.reason, 1_000, 'Shutdown reason is invalid.') ? { reason: String(value.reason).trim() } : {}) };
  }
  if (value.type === 'shutdown_response') {
    assertOnlyKeys(value, ['type', 'request_id', 'approve', 'reason']);
    if (typeof value.approve !== 'boolean') throw new Error('Shutdown response approve must be a boolean.');
    const reason = optionalString(value.reason, 1_000, 'Shutdown reason is invalid.');
    if (!value.approve && !reason) throw new Error('Shutdown reason is required when rejecting a shutdown request.');
    return { type: value.type, request_id: requiredString(value.request_id, 128, 'Shutdown request_id is required.'), approve: value.approve, ...(reason ? { reason } : {}) };
  }
  if (value.type === 'plan_approval_response') {
    assertOnlyKeys(value, ['type', 'request_id', 'approve', 'feedback']);
    if (typeof value.approve !== 'boolean') throw new Error('Plan approval response approve must be a boolean.');
    return { type: value.type, request_id: requiredString(value.request_id, 128, 'Plan request_id is required.'), approve: value.approve, ...(optionalString(value.feedback, 4_000, 'Plan feedback is invalid.') ? { feedback: String(value.feedback).trim() } : {}) };
  }
  throw new Error('SendMessage structured message type is unsupported.');
}

function optionalIdentifier(value: unknown, message: string) {
  if (value === undefined) return undefined;
  const result = optionalString(value, 100, message);
  if (!result || !AGENT_NAME.test(result)) throw new Error(message);
  return result;
}

function optionalName(value: unknown, message: string) {
  if (value === undefined) return undefined;
  const result = optionalString(value, 64, message);
  if (!result || !AGENT_NAME.test(result)) throw new Error(message);
  return result;
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[], message: string): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(message);
  return value as T;
}

function requiredString(value: unknown, maximum: number, message: string) {
  const result = optionalString(value, maximum, message);
  if (!result) throw new Error(message);
  return result;
}

function optionalString(value: unknown, maximum: number, message: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.includes('\0')) throw new Error(message);
  const result = value.trim();
  if (!result || result.length > maximum) throw new Error(message);
  return result;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`Unexpected input properties: ${extras.join(', ')}.`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
