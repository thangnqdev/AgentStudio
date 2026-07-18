import type { ChatThread } from '../../domain/entities/chatThread';
import type { Attachment, Message } from '../../domain/entities/message';

const MAX_HISTORY_THREADS = 80;
const MAX_HISTORY_MESSAGES_PER_THREAD = 120;

function projectAttachment(attachment: Attachment): Attachment {
  return {
    id: attachment.id,
    name: attachment.name,
    type: attachment.type,
    mimeType: attachment.mimeType,
    size: attachment.size,
  };
}

function projectMessage(message: Message): Message {
  return {
    ...message,
    attachments: message.attachments?.map(projectAttachment),
  };
}

export function projectChatHistory(threads: ChatThread[]) {
  return threads.slice(0, MAX_HISTORY_THREADS).map((thread) => ({
    ...thread,
    messages: thread.messages.slice(-MAX_HISTORY_MESSAGES_PER_THREAD).map(projectMessage),
  }));
}
