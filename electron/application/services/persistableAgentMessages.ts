import type { Message } from '../../domain/entities/agent.js';

export function persistableAgentMessages(messages: Message[]): Message[] {
  return messages.map((message) => ({
    ...message,
    attachments: message.attachments?.map((attachment) => {
      const { filePath: _filePath, authorizationToken: _authorizationToken, ...persistable } = attachment;
      return persistable;
    }),
  }));
}
