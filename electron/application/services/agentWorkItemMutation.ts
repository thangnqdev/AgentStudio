import {
  assertAgentWorkItemGraph,
  normalizeAgentWorkItemMetadata,
  type AgentWorkItem,
  type AgentWorkItemBoard,
} from '../../domain/entities/agentWorkItem.js';
import type { UpdateAgentWorkItemInput } from './agentWorkItemInput.js';

export type AgentWorkItemUpdateResult = {
  success: boolean;
  taskId: string;
  updatedFields: string[];
  error?: string;
  statusChange?: { from: string; to: string };
};

export function applyAgentWorkItemUpdate(
  board: AgentWorkItemBoard,
  input: UpdateAgentWorkItemInput,
  timestamp: string,
): AgentWorkItemUpdateResult {
  const item = board.items.find((candidate) => candidate.id === input.taskId);
  if (!item) return { success: false, taskId: input.taskId, updatedFields: [], error: 'Task not found.' };
  if (input.status === 'deleted') {
    removeTask(board, input.taskId);
    return {
      success: true, taskId: input.taskId, updatedFields: ['deleted'],
      statusChange: { from: item.status, to: 'deleted' },
    };
  }

  const updatedFields: string[] = [];
  setChanged(item, 'subject', input.subject, updatedFields);
  setChanged(item, 'description', input.description, updatedFields);
  setChanged(item, 'activeForm', input.activeForm, updatedFields);
  setChanged(item, 'owner', input.owner, updatedFields);
  const previousStatus = item.status;
  setChanged(item, 'status', input.status, updatedFields);
  if (input.metadata) {
    const metadata: Record<string, unknown> = { ...(item.metadata ?? {}) };
    for (const [key, value] of Object.entries(input.metadata)) {
      if (value === null) delete metadata[key];
      else metadata[key] = value;
    }
    item.metadata = normalizeAgentWorkItemMetadata(metadata);
    updatedFields.push('metadata');
  }
  if (addDependencies(board, item.id, input.addBlocks ?? [], true)) updatedFields.push('blocks');
  if (addDependencies(board, item.id, input.addBlockedBy ?? [], false)) updatedFields.push('blockedBy');
  assertAgentWorkItemGraph(board.items);
  if (updatedFields.length > 0) item.updatedAt = timestamp;
  return {
    success: true,
    taskId: item.id,
    updatedFields,
    ...(input.status !== undefined && previousStatus !== input.status
      ? { statusChange: { from: previousStatus, to: input.status } }
      : {}),
  };
}

function setChanged<K extends 'subject' | 'description' | 'activeForm' | 'owner' | 'status'>(
  item: AgentWorkItem,
  field: K,
  value: AgentWorkItem[K] | undefined,
  updatedFields: string[],
) {
  if (value === undefined || item[field] === value) return;
  Object.assign(item, { [field]: value });
  updatedFields.push(field);
}

function addDependencies(board: AgentWorkItemBoard, taskId: string, relatedIds: readonly string[], taskBlocksRelated: boolean) {
  let changed = false;
  for (const relatedId of relatedIds) {
    if (relatedId === taskId) throw new Error('A task cannot depend on itself.');
    const fromId = taskBlocksRelated ? taskId : relatedId;
    const toId = taskBlocksRelated ? relatedId : taskId;
    const from = board.items.find((item) => item.id === fromId);
    const to = board.items.find((item) => item.id === toId);
    if (!from || !to) throw new Error(`Dependency task #${relatedId} was not found.`);
    if (!from.blocks.includes(toId)) { from.blocks.push(toId); changed = true; }
    if (!to.blockedBy.includes(fromId)) { to.blockedBy.push(fromId); changed = true; }
  }
  return changed;
}

function removeTask(board: AgentWorkItemBoard, taskId: string) {
  board.items = board.items.filter((item) => item.id !== taskId);
  for (const item of board.items) {
    item.blocks = item.blocks.filter((id) => id !== taskId);
    item.blockedBy = item.blockedBy.filter((id) => id !== taskId);
  }
}
