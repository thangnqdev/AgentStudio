import {
  AGENT_TEAM_PROTOCOL_VERSION,
  MAX_AGENT_TEAM_PROTOCOL_MESSAGE_CHARACTERS,
  type AgentTeamProtocolJson,
  type AgentTeamProtocolMessage,
  type AgentTeamProtocolPayload,
  type AgentTeamProtocolPermissionMode,
} from './agentTeamProtocol.js';

const MODES: AgentTeamProtocolPermissionMode[] = ['acceptEdits', 'bypassPermissions', 'default', 'dontAsk', 'plan'];
const MAX_TEXT = 20_000;
const MAX_PLAN = 50_000;
const MAX_JSON = 100_000;

export function parseAgentTeamProtocolMessage(value: unknown): AgentTeamProtocolMessage {
  boundedJson(value, MAX_AGENT_TEAM_PROTOCOL_MESSAGE_CHARACTERS);
  const message = object(value, 'message');
  keys(message, ['version', 'id', 'teamId', 'from', 'to', 'createdAt', 'color', 'summary', 'payload']);
  if (message.version !== AGENT_TEAM_PROTOCOL_VERSION) invalid('version');
  requiredText(message.id, 'id', 256); requiredText(message.teamId, 'teamId', 256);
  requiredText(message.from, 'from', 64); requiredText(message.to, 'to', 64);
  timestamp(message.createdAt, 'createdAt'); optionalText(message.color, 'color', 32);
  optionalText(message.summary, 'summary', 160);
  return structuredClone({ ...message, payload: parseAgentTeamProtocolPayload(message.payload) }) as AgentTeamProtocolMessage;
}

export function parseAgentTeamProtocolPayload(value: unknown): AgentTeamProtocolPayload {
  boundedJson(value, MAX_AGENT_TEAM_PROTOCOL_MESSAGE_CHARACTERS);
  const payload = object(value, 'payload');
  const type = requiredText(payload.type, 'type', 64);
  switch (type) {
    case 'message':
      keys(payload, ['type', 'text']); requiredText(payload.text, 'text', MAX_TEXT); break;
    case 'permission_request':
      keys(payload, ['type', 'request_id', 'agent_id', 'tool_name', 'tool_use_id', 'description', 'input', 'permission_suggestions']);
      requestId(payload.request_id); name(payload.agent_id, 'agent_id'); name(payload.tool_name, 'tool_name');
      requestId(payload.tool_use_id, 'tool_use_id'); requiredText(payload.description, 'description', 2_000);
      jsonObject(payload.input, 'input'); jsonArray(payload.permission_suggestions, 'permission_suggestions', 100); break;
    case 'permission_response':
      parsePermissionResponse(payload); break;
    case 'sandbox_permission_request':
      keys(payload, ['type', 'requestId', 'workerId', 'workerName', 'workerColor', 'hostPattern', 'createdAt']);
      requestId(payload.requestId); requestId(payload.workerId, 'workerId'); name(payload.workerName, 'workerName');
      optionalText(payload.workerColor, 'workerColor', 32); hostPattern(payload.hostPattern);
      if (!Number.isSafeInteger(payload.createdAt) || Number(payload.createdAt) < 0) invalid('createdAt'); break;
    case 'sandbox_permission_response':
      keys(payload, ['type', 'requestId', 'host', 'allow', 'timestamp']); requestId(payload.requestId);
      requiredText(payload.host, 'host', 1_024); bool(payload.allow, 'allow'); timestamp(payload.timestamp, 'timestamp'); break;
    case 'plan_approval_request':
      keys(payload, ['type', 'from', 'timestamp', 'planFilePath', 'planContent', 'requestId']); name(payload.from, 'from');
      timestamp(payload.timestamp, 'timestamp'); requiredText(payload.planFilePath, 'planFilePath', 4_096);
      requiredText(payload.planContent, 'planContent', MAX_PLAN); requestId(payload.requestId); break;
    case 'plan_approval_response':
      keys(payload, ['type', 'requestId', 'approved', 'feedback', 'timestamp', 'permissionMode']); requestId(payload.requestId);
      bool(payload.approved, 'approved'); optionalText(payload.feedback, 'feedback', 2_000); timestamp(payload.timestamp, 'timestamp');
      if (payload.permissionMode !== undefined && !MODES.includes(payload.permissionMode as AgentTeamProtocolPermissionMode)) invalid('permissionMode'); break;
    case 'shutdown_request':
      senderTimestamp(payload, ['type', 'requestId', 'from', 'reason', 'timestamp']); requestId(payload.requestId);
      optionalText(payload.reason, 'reason', 1_000); break;
    case 'shutdown_approved':
      senderTimestamp(payload, ['type', 'requestId', 'from', 'timestamp', 'paneId', 'backendType']); requestId(payload.requestId);
      optionalText(payload.paneId, 'paneId', 256); optionalText(payload.backendType, 'backendType', 64); break;
    case 'shutdown_rejected':
      senderTimestamp(payload, ['type', 'requestId', 'from', 'reason', 'timestamp']); requestId(payload.requestId);
      requiredText(payload.reason, 'reason', 1_000); break;
    case 'idle_notification':
      parseIdle(payload); break;
    case 'task_assignment':
      keys(payload, ['type', 'taskId', 'subject', 'description', 'assignedBy', 'timestamp']); requestId(payload.taskId, 'taskId');
      requiredText(payload.subject, 'subject', 500); requiredText(payload.description, 'description', 5_000);
      name(payload.assignedBy, 'assignedBy'); timestamp(payload.timestamp, 'timestamp'); break;
    case 'team_permission_update':
      parseTeamPermissionUpdate(payload); break;
    case 'mode_set_request':
      keys(payload, ['type', 'mode', 'from']); name(payload.from, 'from');
      if (!MODES.includes(payload.mode as AgentTeamProtocolPermissionMode)) invalid('mode'); break;
    default: invalid('type');
  }
  return structuredClone(payload) as AgentTeamProtocolPayload;
}

function parsePermissionResponse(payload: Record<string, unknown>) {
  const subtype = requiredText(payload.subtype, 'subtype', 16);
  if (subtype === 'error') {
    keys(payload, ['type', 'request_id', 'subtype', 'error']); requestId(payload.request_id); requiredText(payload.error, 'error', 2_000); return;
  }
  if (subtype !== 'success') invalid('subtype');
  keys(payload, ['type', 'request_id', 'subtype', 'response']); requestId(payload.request_id);
  if (payload.response === undefined) return;
  const response = object(payload.response, 'response'); keys(response, ['updated_input', 'permission_updates']);
  if (response.updated_input !== undefined) jsonObject(response.updated_input, 'updated_input');
  if (response.permission_updates !== undefined) jsonArray(response.permission_updates, 'permission_updates', 100);
}

function parseIdle(payload: Record<string, unknown>) {
  keys(payload, ['type', 'from', 'timestamp', 'idleReason', 'summary', 'completedTaskId', 'completedStatus', 'failureReason']);
  name(payload.from, 'from'); timestamp(payload.timestamp, 'timestamp'); optionalText(payload.summary, 'summary', 160);
  optionalText(payload.completedTaskId, 'completedTaskId', 256); optionalText(payload.failureReason, 'failureReason', 2_000);
  if (payload.idleReason !== undefined && !['available', 'interrupted', 'failed'].includes(String(payload.idleReason))) invalid('idleReason');
  if (payload.completedStatus !== undefined && !['resolved', 'blocked', 'failed'].includes(String(payload.completedStatus))) invalid('completedStatus');
}

function parseTeamPermissionUpdate(payload: Record<string, unknown>) {
  keys(payload, ['type', 'permissionUpdate', 'directoryPath', 'toolName']);
  requiredText(payload.directoryPath, 'directoryPath', 4_096); name(payload.toolName, 'toolName');
  const update = object(payload.permissionUpdate, 'permissionUpdate'); keys(update, ['type', 'rules', 'behavior', 'destination']);
  if (update.type !== 'addRules' || update.destination !== 'session' || !['allow', 'deny', 'ask'].includes(String(update.behavior))) invalid('permissionUpdate');
  if (!Array.isArray(update.rules) || update.rules.length > 100) invalid('rules');
  for (const raw of update.rules) {
    const rule = object(raw, 'rule'); keys(rule, ['toolName', 'ruleContent']); name(rule.toolName, 'toolName'); optionalText(rule.ruleContent, 'ruleContent', 4_096);
  }
}

function senderTimestamp(payload: Record<string, unknown>, allowed: string[]) {
  keys(payload, allowed); name(payload.from, 'from'); timestamp(payload.timestamp, 'timestamp');
}
function hostPattern(value: unknown) { const pattern = object(value, 'hostPattern'); keys(pattern, ['host']); requiredText(pattern.host, 'host', 1_024); }
function requestId(value: unknown, field = 'requestId') { requiredText(value, field, 256); }
function name(value: unknown, field: string) { requiredText(value, field, 128); }
function bool(value: unknown, field: string) { if (typeof value !== 'boolean') invalid(field); }
function timestamp(value: unknown, field: string) { const text = requiredText(value, field, 64); if (!Number.isFinite(Date.parse(text))) invalid(field); }
function optionalText(value: unknown, field: string, maximum: number) { if (value !== undefined) requiredText(value, field, maximum); }
function requiredText(value: unknown, field: string, maximum: number) {
  if (typeof value !== 'string' || !value || value.includes('\0') || value.length > maximum) invalid(field);
  return value;
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(field);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(field);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  const accepted = new Set(allowed); if (Object.keys(value).some((key) => !accepted.has(key))) invalid('unknown field');
}
function jsonObject(value: unknown, field: string) { object(value, field); jsonValue(value, field, 0); boundedJson(value, MAX_JSON); }
function jsonArray(value: unknown, field: string, maximum: number) { if (!Array.isArray(value) || value.length > maximum) invalid(field); jsonValue(value, field, 0); boundedJson(value, MAX_JSON); }
function jsonValue(value: unknown, field: string, depth: number): asserts value is AgentTeamProtocolJson {
  if (depth > 12) invalid(field);
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return;
  if (Array.isArray(value)) { if (value.length > 1_000) invalid(field); value.forEach((item) => jsonValue(item, field, depth + 1)); return; }
  const record = object(value, field); const entries = Object.entries(record); if (entries.length > 1_000) invalid(field);
  for (const [key, item] of entries) { if (['__proto__', 'prototype', 'constructor'].includes(key)) invalid(field); jsonValue(item, field, depth + 1); }
}
function boundedJson(value: unknown, maximum: number) {
  let serialized: string | undefined; try { serialized = JSON.stringify(value); } catch { invalid('JSON'); }
  if (!serialized || serialized.length > maximum) invalid('size');
}
function invalid(field: string): never { throw new Error(`Agent team protocol ${field} is invalid.`); }
