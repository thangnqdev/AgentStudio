import type { AgentStartPayload, Attachment, Message } from '../../domain/entities/agent.js';

const MAX_MESSAGE_ACTIONS = 32;
const MAX_ACTION_ID_CHARS = 256;
const MAX_TOOL_NAME_CHARS = 128;
const MAX_ACTION_ARGS_CHARS = 2_000;
const MAX_ACTION_OUTPUT_CHARS = 120_000;
const SAFE_TOOL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;

export function parseAgentStartPayload(rawPayload: unknown): AgentStartPayload {
  if (!isObject(rawPayload)) return {};

  return {
    requestId: getOptionalString(rawPayload.requestId),
    taskId: getOptionalString(rawPayload.taskId),
    taskListId: getOptionalTaskListId(rawPayload.taskListId),
    messages: Array.isArray(rawPayload.messages)
      ? rawPayload.messages.map(parseMessage).filter((message): message is Message => message !== null)
      : [],
  };
}

function parseMessage(value: unknown): Message | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== 'string' || typeof value.content !== 'string') return null;
  if (value.sender !== 'user' && value.sender !== 'agent' && value.sender !== 'system') return null;

  const attachments = Array.isArray(value.attachments)
    ? value.attachments.map(parseAttachment).filter((attachment): attachment is Attachment => attachment !== null)
    : undefined;
  const actions = Array.isArray(value.actions)
    ? value.actions.slice(-MAX_MESSAGE_ACTIONS).map(parseAction).filter((action): action is NonNullable<Message['actions']>[number] => action !== null)
    : undefined;

  return {
    id: value.id,
    sender: value.sender,
    content: value.content,
    ...(attachments?.length ? { attachments } : {}),
    ...(actions?.length ? { actions } : {}),
  };
}

function parseAction(value: unknown): NonNullable<Message['actions']>[number] | null {
  if (!isObject(value)) return null;
  const id = getBoundedString(value.id, MAX_ACTION_ID_CHARS);
  const toolName = getBoundedString(value.toolName, MAX_TOOL_NAME_CHARS);
  const args = getBoundedString(value.args, MAX_ACTION_ARGS_CHARS);
  const output = value.output === undefined ? undefined : getBoundedString(value.output, MAX_ACTION_OUTPUT_CHARS);
  if (!id || !toolName || !SAFE_TOOL_NAME.test(toolName) || args === null || args === undefined || output === null) return null;
  if (!['read', 'write', 'execute', 'network'].includes(String(value.risk))) return null;
  if (!['awaiting_approval', 'denied', 'running', 'ok', 'error'].includes(String(value.status))) return null;
  return {
    id,
    toolName,
    args,
    risk: value.risk as NonNullable<Message['actions']>[number]['risk'],
    status: value.status as NonNullable<Message['actions']>[number]['status'],
    ...(output !== undefined ? { output } : {}),
  };
}

function parseAttachment(value: unknown): Attachment | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (value.type !== 'text' && value.type !== 'image' && value.type !== 'audio' && value.type !== 'video') return null;

  return {
    id: value.id,
    name: value.name,
    type: value.type,
    data: getOptionalString(value.data),
    filePath: getOptionalString(value.filePath),
    mimeType: getOptionalString(value.mimeType),
    size: typeof value.size === 'number' && Number.isFinite(value.size) && value.size >= 0 ? value.size : undefined,
  };
}

function getOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function getBoundedString(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.includes('\0') || value.length > maxLength) return null;
  return value;
}

function getOptionalTaskListId(value: unknown) {
  if (typeof value !== 'string' || value.length > 128 || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(value)) return undefined;
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
