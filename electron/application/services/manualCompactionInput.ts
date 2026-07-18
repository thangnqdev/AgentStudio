import type { Message } from '../../domain/entities/agent.js';
import { parseAgentMessages } from './agentStartPayloadValidation.js';

const MAX_MANUAL_COMPACTION_MESSAGES = 1_000;
const MAX_MANUAL_COMPACTION_TEXT_CHARS = 12_000_000;

export type ManualCompactionInput = {
  messages: Message[];
  instructions?: string;
  scopeId?: string;
};

export function parseManualCompactionInput(raw: unknown): ManualCompactionInput {
  const value = isObject(raw) ? raw : {};
  const messages = parseMessages(value.messages);
  const instructions = boundedText(value.instructions, 2_000);
  const scopeId = boundedIdentity(value.scopeId);
  return {
    messages,
    ...(instructions ? { instructions } : {}),
    ...(scopeId ? { scopeId } : {}),
  };
}

function parseMessages(value: unknown) {
  if (!Array.isArray(value)) throw new Error('Danh sách tin nhắn compact không hợp lệ.');
  if (value.length > MAX_MANUAL_COMPACTION_MESSAGES) {
    throw new Error(`Chỉ có thể compact tối đa ${MAX_MANUAL_COMPACTION_MESSAGES} tin nhắn mỗi lần.`);
  }
  const messages = parseAgentMessages(value, MAX_MANUAL_COMPACTION_MESSAGES);
  if (messages.length !== value.length) throw new Error('Có tin nhắn compact không hợp lệ.');
  if (new Set(messages.map((message) => message.id)).size !== messages.length) {
    throw new Error('ID tin nhắn compact bị trùng.');
  }
  const textCharacters = messages.reduce((total, message) => total + messageTextCharacters(message), 0);
  if (textCharacters > MAX_MANUAL_COMPACTION_TEXT_CHARS) {
    throw new Error('Nội dung hội thoại quá lớn để compact trong một lần.');
  }
  return messages;
}

function messageTextCharacters(message: Message) {
  const attachments = (message.attachments ?? []).reduce((total, attachment) => total + (attachment.data?.length ?? 0), 0);
  const actions = (message.actions ?? []).reduce((total, action) => total + action.args.length + (action.output?.length ?? 0), 0);
  return message.content.length + attachments + actions;
}

function boundedText(value: unknown, maximum: number) {
  if (typeof value !== 'string') return '';
  const text = value.replaceAll('\0', '').trim();
  return text.slice(0, maximum);
}

function boundedIdentity(value: unknown) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value) ? value : '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
