import type { AgentStartPayload, Attachment, Message } from '../../domain/entities/agent.js';
import { MAX_FILE_BYTES, MAX_IMAGE_BYTES } from '../../domain/entities/limits.js';

const MAX_MESSAGES = 200;
const MAX_MESSAGE_CHARS = 120_000;
const MAX_ATTACHMENTS_PER_MESSAGE = 16;
const MAX_MESSAGE_ID_CHARS = 256;
const MAX_ATTACHMENT_NAME_CHARS = 512;
const MAX_AUTHORIZATION_TOKEN_CHARS = 128;
const MAX_MIME_TYPE_CHARS = 200;
const MAX_INLINE_IMAGE_CHARS = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 512;
const MAX_MESSAGE_ACTIONS = 32;
const MAX_ACTION_ID_CHARS = 256;
const MAX_TOOL_NAME_CHARS = 128;
const MAX_ACTION_ARGS_CHARS = 2_000;
const MAX_ACTION_OUTPUT_CHARS = 120_000;
const SAFE_TOOL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;

export function parseAgentStartPayload(rawPayload: unknown): AgentStartPayload {
  if (!isObject(rawPayload)) return {};

  return {
    requestId: getBoundedString(rawPayload.requestId, MAX_MESSAGE_ID_CHARS) || undefined,
    taskId: getBoundedString(rawPayload.taskId, MAX_MESSAGE_ID_CHARS) || undefined,
    taskListId: getOptionalTaskListId(rawPayload.taskListId),
    messages: parseAgentMessages(rawPayload.messages, MAX_MESSAGES),
  };
}

export function parseAgentMessages(rawMessages: unknown, maximumMessages = MAX_MESSAGES): Message[] {
  if (!Array.isArray(rawMessages)) return [];
  const limit = Number.isFinite(maximumMessages) ? Math.max(0, Math.floor(maximumMessages)) : MAX_MESSAGES;
  if (limit === 0) return [];
  return rawMessages.slice(-limit).map(parseMessage).filter((message): message is Message => message !== null);
}

function parseMessage(value: unknown): Message | null {
  if (!isObject(value)) return null;
  const id = getBoundedString(value.id, MAX_MESSAGE_ID_CHARS);
  const content = getBoundedString(value.content, MAX_MESSAGE_CHARS);
  if (!id || content === null || content === undefined) return null;
  if (value.sender !== 'user' && value.sender !== 'agent' && value.sender !== 'system') return null;

  const attachments = Array.isArray(value.attachments)
    ? value.attachments.slice(-MAX_ATTACHMENTS_PER_MESSAGE).map(parseAttachment).filter((attachment): attachment is Attachment => attachment !== null)
    : undefined;
  const actions = Array.isArray(value.actions)
    ? value.actions.slice(-MAX_MESSAGE_ACTIONS).map(parseAction).filter((action): action is NonNullable<Message['actions']>[number] => action !== null)
    : undefined;

  return {
    id,
    sender: value.sender,
    content,
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
  const id = getBoundedString(value.id, MAX_MESSAGE_ID_CHARS);
  const name = getBoundedString(value.name, MAX_ATTACHMENT_NAME_CHARS);
  if (!id || !name) return null;
  if (value.type !== 'text' && value.type !== 'image' && value.type !== 'audio' && value.type !== 'video') return null;

  const data = parseInlineAttachmentData(value.data, value.type);
  const authorizationToken = getBoundedString(value.authorizationToken, MAX_AUTHORIZATION_TOKEN_CHARS);
  const mimeType = getBoundedString(value.mimeType, MAX_MIME_TYPE_CHARS);

  return {
    id,
    name,
    type: value.type,
    data: data || undefined,
    authorizationToken: authorizationToken || undefined,
    mimeType: mimeType || undefined,
    size: typeof value.size === 'number' && Number.isFinite(value.size) && value.size >= 0 ? value.size : undefined,
  };
}

function parseInlineAttachmentData(value: unknown, type: Attachment['type']) {
  if (type === 'text') return getBoundedString(value, MAX_FILE_BYTES);
  if (type !== 'image') return undefined;
  const data = getBoundedString(value, MAX_INLINE_IMAGE_CHARS);
  return data && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=\r\n]*$/.test(data) ? data : undefined;
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
