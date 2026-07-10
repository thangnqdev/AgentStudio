import type { ChatMessage, Message } from '../entities/agent.js';

export interface IAttachmentMessageFormatter {
  format(messages: Message[]): Promise<ChatMessage[]>;
}
