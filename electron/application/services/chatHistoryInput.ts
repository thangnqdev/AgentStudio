const MAX_THREADS = 80;
const MAX_MESSAGES_PER_THREAD = 120;
const MAX_ATTACHMENTS_PER_MESSAGE = 16;
const MAX_ACTIONS_PER_MESSAGE = 32;
const MAX_TOTAL_TEXT_CHARS = 12_000_000;

export function parseChatHistoryInput(raw: unknown) {
  const payload = object(raw, 'Lịch sử chat không hợp lệ.');
  if (!Array.isArray(payload.threads)) throw new Error('Danh sách thread không hợp lệ.');
  const threads = payload.threads.slice(0, MAX_THREADS).map(parseThread);
  const activeThreadId = payload.activeThreadId === undefined || payload.activeThreadId === null
    ? null
    : nonEmptyString(payload.activeThreadId, 256);
  const totalCharacters = threads.reduce((total, thread) => total + thread.messages.reduce(
    (messageTotal, message) => messageTotal + message.content.length
      + (message.actions ?? []).reduce((actionTotal, action) => actionTotal + action.args.length + (action.output?.length ?? 0), 0),
    0,
  ), 0);
  if (totalCharacters > MAX_TOTAL_TEXT_CHARS) throw new Error('Lịch sử chat vượt giới hạn lưu trữ.');
  return { threads, activeThreadId };
}

function parseThread(raw: unknown) {
  const value = object(raw, 'Thread chat không hợp lệ.');
  if (!Array.isArray(value.messages)) throw new Error('Danh sách message không hợp lệ.');
  return {
    id: nonEmptyString(value.id, 256),
    title: nonEmptyString(value.title, 96),
    ...(value.customTitle === true ? { customTitle: true } : {}),
    messages: value.messages.slice(-MAX_MESSAGES_PER_THREAD).map(parseMessage),
    createdAt: dateString(value.createdAt),
    updatedAt: dateString(value.updatedAt),
  };
}

function parseMessage(raw: unknown) {
  const value = object(raw, 'Message chat không hợp lệ.');
  if (value.sender !== 'user' && value.sender !== 'agent' && value.sender !== 'system') {
    throw new Error('Sender của message không hợp lệ.');
  }
  const type = value.type === undefined ? undefined : enumValue(value.type, ['text', 'code', 'permission_request']);
  const status = value.status === undefined ? undefined : enumValue(value.status, ['sending', 'done', 'error']);
  if (value.attachments !== undefined && !Array.isArray(value.attachments)) throw new Error('Attachment list trong history không hợp lệ.');
  if (value.actions !== undefined && !Array.isArray(value.actions)) throw new Error('Tool action list trong history không hợp lệ.');
  return {
    id: nonEmptyString(value.id, 256), sender: value.sender, content: requiredString(value.content, 120_000),
    ...(type ? { type } : {}), ...(status ? { status } : {}), timestamp: dateString(value.timestamp),
    ...(value.attachments?.length ? {
      attachments: value.attachments.slice(0, MAX_ATTACHMENTS_PER_MESSAGE).map(parseAttachment),
    } : {}),
    ...(value.actions?.length ? {
      actions: value.actions.slice(0, MAX_ACTIONS_PER_MESSAGE).map(parseAction),
    } : {}),
  };
}

function parseAttachment(raw: unknown) {
  const value = object(raw, 'Attachment trong history không hợp lệ.');
  const type = enumValue(value.type, ['text', 'image', 'audio', 'video']);
  const mimeType = optionalString(value.mimeType, 200);
  const size = typeof value.size === 'number' && Number.isFinite(value.size) && value.size >= 0 ? value.size : undefined;
  return {
    id: nonEmptyString(value.id, 256), name: nonEmptyString(value.name, 512), type,
    ...(mimeType ? { mimeType } : {}), ...(size !== undefined ? { size } : {}),
  };
}

function parseAction(raw: unknown) {
  const value = object(raw, 'Tool action trong history không hợp lệ.');
  const output = optionalString(value.output, 120_000);
  return {
    id: nonEmptyString(value.id, 256), requestId: nonEmptyString(value.requestId, 256),
    toolName: nonEmptyString(value.toolName, 128), args: requiredString(value.args, 2_000),
    risk: enumValue(value.risk, ['read', 'write', 'execute', 'network']),
    status: enumValue(value.status, ['awaiting_approval', 'denied', 'running', 'ok', 'error']),
    ...(output !== undefined ? { output } : {}),
  };
}

function object(value: unknown, error: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(error);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, maximum: number) {
  if (typeof value !== 'string' || value.includes('\0') || value.length > maximum) throw new Error('Chuỗi history không hợp lệ.');
  return value;
}

function nonEmptyString(value: unknown, maximum: number) {
  const result = requiredString(value, maximum);
  if (!result) throw new Error('Chuỗi history bắt buộc bị trống.');
  return result;
}

function optionalString(value: unknown, maximum: number) {
  if (value === undefined || value === null) return undefined;
  return requiredString(value, maximum);
}

function dateString(value: unknown) {
  const date = value instanceof Date ? value : new Date(typeof value === 'string' ? value : Number.NaN);
  if (!Number.isFinite(date.getTime())) throw new Error('Timestamp trong history không hợp lệ.');
  return date.toISOString();
}

function enumValue<const T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error('Enum trong history không hợp lệ.');
  return value as T;
}
