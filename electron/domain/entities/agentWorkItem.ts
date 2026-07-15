export const AGENT_WORK_ITEM_STATUSES = ['pending', 'in_progress', 'completed'] as const;
export type AgentWorkItemStatus = typeof AGENT_WORK_ITEM_STATUSES[number];

export type AgentWorkItem = {
  id: string;
  subject: string;
  description: string;
  activeForm?: string;
  owner?: string;
  status: AgentWorkItemStatus;
  blocks: string[];
  blockedBy: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentWorkItemBoard = {
  version: 1;
  nextId: number;
  items: AgentWorkItem[];
};

export const MAX_AGENT_WORK_ITEMS = 500;
export const MAX_AGENT_WORK_ITEM_DEPENDENCIES = 100;
export const MAX_AGENT_WORK_ITEM_METADATA_BYTES = 8 * 1024;

export function createEmptyAgentWorkItemBoard(): AgentWorkItemBoard {
  return { version: 1, nextId: 1, items: [] };
}

export function parseAgentWorkItemBoard(raw: unknown): AgentWorkItemBoard {
  if (!isObject(raw) || raw.version !== 1 || typeof raw.nextId !== 'number' || !Number.isSafeInteger(raw.nextId) || raw.nextId < 1 || !Array.isArray(raw.items)) {
    throw new Error('Agent work-item store has an invalid envelope.');
  }
  if (raw.items.length > MAX_AGENT_WORK_ITEMS) throw new Error('Agent work-item limit exceeded.');
  const items = raw.items.map(parseWorkItem);
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error('Agent work-item store contains duplicate IDs.');
  const highestId = items.reduce((highest, item) => Math.max(highest, Number(item.id)), 0);
  if (Number(raw.nextId) <= highestId) throw new Error('Agent work-item next ID is invalid.');
  assertAgentWorkItemGraph(items);
  return { version: 1, nextId: Number(raw.nextId), items };
}

export function assertAgentWorkItemGraph(items: readonly AgentWorkItem[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    for (const blockedId of item.blocks) {
      const blocked = byId.get(blockedId);
      if (!blocked || !blocked.blockedBy.includes(item.id)) throw new Error(`Task dependency ${item.id} -> ${blockedId} is inconsistent.`);
    }
    for (const blockerId of item.blockedBy) {
      const blocker = byId.get(blockerId);
      if (!blocker || !blocker.blocks.includes(item.id)) throw new Error(`Task dependency ${blockerId} -> ${item.id} is inconsistent.`);
    }
  }
  if (containsDependencyCycle(items)) throw new Error('Task dependencies cannot contain a cycle.');
}

function parseWorkItem(raw: unknown): AgentWorkItem {
  if (!isObject(raw)) throw new Error('Agent work-item entry is invalid.');
  const id = readId(raw.id);
  const status = readStatus(raw.status);
  const blocks = readIds(raw.blocks, id);
  const blockedBy = readIds(raw.blockedBy, id);
  return {
    id,
    subject: readString(raw.subject, 200, 'Task subject is invalid.'),
    description: readString(raw.description, 8_000, 'Task description is invalid.', true),
    ...(raw.activeForm === undefined ? {} : { activeForm: readString(raw.activeForm, 200, 'Task active form is invalid.') }),
    ...(raw.owner === undefined ? {} : { owner: readString(raw.owner, 128, 'Task owner is invalid.') }),
    status,
    blocks,
    blockedBy,
    ...(raw.metadata === undefined ? {} : { metadata: normalizeAgentWorkItemMetadata(raw.metadata) }),
    createdAt: readTimestamp(raw.createdAt),
    updatedAt: readTimestamp(raw.updatedAt),
  };
}

function readId(value: unknown) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,14}$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error('Task ID is invalid.');
  }
  return value;
}

function readStatus(value: unknown): AgentWorkItemStatus {
  if (typeof value !== 'string' || !(AGENT_WORK_ITEM_STATUSES as readonly string[]).includes(value)) {
    throw new Error('Task status is invalid.');
  }
  return value as AgentWorkItemStatus;
}

function readIds(value: unknown, ownId: string) {
  if (!Array.isArray(value) || value.length > MAX_AGENT_WORK_ITEM_DEPENDENCIES) throw new Error('Task dependency list is invalid.');
  const ids = value.map(readId);
  if (ids.includes(ownId) || new Set(ids).size !== ids.length) throw new Error('Task dependency list is invalid.');
  return ids;
}

export function normalizeAgentWorkItemMetadata(value: unknown) {
  if (!isObject(value)) throw new Error('Task metadata is invalid.');
  const serialized = JSON.stringify(value);
  if (!serialized || utf8ByteLength(serialized) > MAX_AGENT_WORK_ITEM_METADATA_BYTES) throw new Error('Task metadata is invalid or too large.');
  return JSON.parse(serialized) as Record<string, unknown>;
}

function readTimestamp(value: unknown) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Task timestamp is invalid.');
  return value;
}

function readString(value: unknown, maximum: number, message: string, allowEmpty = false) {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error(message);
  const result = value.trim();
  if ((!allowEmpty && !result) || result.length > maximum) throw new Error(message);
  return result;
}

function containsDependencyCycle(items: readonly AgentWorkItem[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of byId.get(id)?.blocks ?? []) if (visit(next)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return items.some((item) => visit(item.id));
}

function utf8ByteLength(value: string) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
