import {
  AGENT_WORK_ITEM_STATUSES,
  MAX_AGENT_WORK_ITEM_DEPENDENCIES,
  normalizeAgentWorkItemMetadata,
  type AgentWorkItemStatus,
} from '../../domain/entities/agentWorkItem.js';

export type CreateAgentWorkItemInput = {
  subject: string;
  description: string;
  activeForm?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateAgentWorkItemInput = {
  taskId: string;
  subject?: string;
  description?: string;
  activeForm?: string;
  owner?: string;
  status?: AgentWorkItemStatus | 'deleted';
  addBlocks?: string[];
  addBlockedBy?: string[];
  metadata?: Record<string, unknown>;
};

const CREATE_FIELDS = new Set(['subject', 'description', 'activeForm', 'metadata']);
const UPDATE_FIELDS = new Set([
  'taskId', 'subject', 'description', 'activeForm', 'owner', 'status',
  'addBlocks', 'addBlockedBy', 'metadata',
]);

export function parseCreateAgentWorkItemInput(raw: Record<string, unknown>): CreateAgentWorkItemInput {
  rejectUnknownFields(raw, CREATE_FIELDS);
  return {
    subject: readText(raw.subject, 200, 'Task subject is required.'),
    description: readText(raw.description, 8_000, 'Task description is required.', true),
    ...(raw.activeForm === undefined ? {} : { activeForm: readText(raw.activeForm, 200, 'Task active form is invalid.') }),
    ...(raw.metadata === undefined ? {} : { metadata: normalizeAgentWorkItemMetadata(raw.metadata) }),
  };
}

export function parseUpdateAgentWorkItemInput(raw: Record<string, unknown>): UpdateAgentWorkItemInput {
  rejectUnknownFields(raw, UPDATE_FIELDS);
  const status = raw.status === undefined ? undefined : readUpdateStatus(raw.status);
  return {
    taskId: readTaskId(raw.taskId),
    ...(raw.subject === undefined ? {} : { subject: readText(raw.subject, 200, 'Task subject is invalid.') }),
    ...(raw.description === undefined ? {} : { description: readText(raw.description, 8_000, 'Task description is invalid.', true) }),
    ...(raw.activeForm === undefined ? {} : { activeForm: readText(raw.activeForm, 200, 'Task active form is invalid.') }),
    ...(raw.owner === undefined ? {} : { owner: readText(raw.owner, 128, 'Task owner is invalid.') }),
    ...(status === undefined ? {} : { status }),
    ...(raw.addBlocks === undefined ? {} : { addBlocks: readTaskIds(raw.addBlocks) }),
    ...(raw.addBlockedBy === undefined ? {} : { addBlockedBy: readTaskIds(raw.addBlockedBy) }),
    ...(raw.metadata === undefined ? {} : { metadata: normalizeAgentWorkItemMetadata(raw.metadata) }),
  };
}

export function parseTaskIdInput(raw: Record<string, unknown>) {
  rejectUnknownFields(raw, new Set(['taskId']));
  return readTaskId(raw.taskId);
}

export function assertEmptyTaskInput(raw: Record<string, unknown>) {
  rejectUnknownFields(raw, new Set());
}

function readUpdateStatus(value: unknown): AgentWorkItemStatus | 'deleted' {
  if (value === 'deleted') return value;
  if (typeof value === 'string' && (AGENT_WORK_ITEM_STATUSES as readonly string[]).includes(value)) return value as AgentWorkItemStatus;
  throw new Error('Task status must be pending, in_progress, completed, or deleted.');
}

function readTaskIds(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_AGENT_WORK_ITEM_DEPENDENCIES) throw new Error('Task dependency list is invalid.');
  const ids = value.map(readTaskId);
  if (new Set(ids).size !== ids.length) throw new Error('Task dependency list contains duplicates.');
  return ids;
}

function readTaskId(value: unknown) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,14}$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error('taskId must be a positive numeric string.');
  }
  return value;
}

function readText(value: unknown, maximum: number, message: string, allowEmpty = false) {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error(message);
  const result = value.trim();
  if ((!allowEmpty && !result) || result.length > maximum) throw new Error(message);
  return result;
}

function rejectUnknownFields(raw: Record<string, unknown>, allowed: ReadonlySet<string>) {
  const unknown = Object.keys(raw).find((field) => !allowed.has(field));
  if (unknown) throw new Error(`Unsupported task field: ${unknown}.`);
}
