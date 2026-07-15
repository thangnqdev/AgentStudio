import type { AgentStartPayload, Attachment, Message } from '../../domain/entities/agent.js';

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

  return {
    id: value.id,
    sender: value.sender,
    content: value.content,
    ...(attachments?.length ? { attachments } : {}),
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

function getOptionalTaskListId(value: unknown) {
  if (typeof value !== 'string' || value.length > 128 || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(value)) return undefined;
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
