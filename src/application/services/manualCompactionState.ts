import type { ManualCompactionMessage, ManualCompactionResult } from '../../domain/entities/manualCompaction';
import type { Message } from '../../domain/entities/message';

export function projectManualCompactionMessages(messages: Message[]): ManualCompactionMessage[] {
  return messages.map((message) => ({
    id: message.id,
    sender: message.sender,
    content: message.content,
    ...(message.attachments?.length ? {
      attachments: message.attachments.map(({ id, name, type, mimeType, size }) => ({
        id, name, type, ...(mimeType ? { mimeType } : {}), ...(size !== undefined ? { size } : {}),
      })),
    } : {}),
    ...(message.actions?.length ? {
      actions: message.actions.map(({ id, toolName, args, risk, status, output }) => ({
        id, toolName, args, risk, status, ...(output !== undefined ? { output } : {}),
      })),
    } : {}),
  }));
}

export function isManualCompactionSnapshotCurrent(
  snapshot: { activeThreadId: string | null; messages: Message[] },
  current: { activeThreadId: string | null; messages: Message[] },
) {
  return current.activeThreadId === snapshot.activeThreadId && current.messages === snapshot.messages;
}

export function buildManualCompactionMessages(
  current: Message[],
  result: ManualCompactionResult,
  dependencies: { createId: () => string; now: () => Date },
): Message[] | null {
  if (!result.compacted || !result.summary) return null;
  const kept = new Set(result.keptMessageIds);
  return [{
    id: dependencies.createId(), sender: 'agent', content: result.summary,
    timestamp: dependencies.now(), status: 'done', type: 'text',
  }, ...current.filter((message) => kept.has(message.id))];
}
