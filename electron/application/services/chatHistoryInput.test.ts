import { describe, expect, it } from 'vitest';
import { parseChatHistoryInput } from './chatHistoryInput.js';

function historyWithAttachment(attachment: Record<string, unknown>) {
  return {
    activeThreadId: 'thread',
    threads: [{
      id: 'thread', title: 'Title', customTitle: true,
      createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:00.000Z',
      messages: [{
        id: 'message', sender: 'user', content: 'hello', status: 'done',
        timestamp: '2026-07-18T00:00:00.000Z', attachments: [attachment],
      }],
    }],
  };
}

describe('parseChatHistoryInput', () => {
  it('strips all attachment authority and bytes at the main-process boundary', () => {
    const result = parseChatHistoryInput(historyWithAttachment({
      id: 'attachment', name: 'private.png', type: 'image', mimeType: 'image/png', size: 12,
      filePath: '/private/file', authorizationToken: 'secret', previewUrl: 'blob:secret', data: 'secret-bytes',
    }));
    expect(result.threads[0]?.messages[0]?.attachments).toEqual([
      { id: 'attachment', name: 'private.png', type: 'image', mimeType: 'image/png', size: 12 },
    ]);
  });

  it('rejects malformed nested records instead of trusting renderer types', () => {
    expect(() => parseChatHistoryInput(historyWithAttachment({
      id: 'attachment', name: 'bad', type: 'executable',
    }))).toThrow('Enum trong history không hợp lệ.');
    expect(() => parseChatHistoryInput({ threads: 'not-an-array' })).toThrow('Danh sách thread không hợp lệ.');
    const invalidNested = historyWithAttachment({ id: 'attachment', name: 'safe', type: 'text' });
    invalidNested.threads[0].messages[0].attachments = 'not-an-array' as never;
    expect(() => parseChatHistoryInput(invalidNested)).toThrow('Attachment list trong history không hợp lệ.');
  });

  it('bounds retained threads and messages in main as well as renderer', () => {
    const base = historyWithAttachment({ id: 'attachment', name: 'safe.txt', type: 'text' }).threads[0];
    const result = parseChatHistoryInput({
      threads: Array.from({ length: 81 }, (_, threadIndex) => ({
        ...base, id: `thread-${threadIndex}`,
        messages: Array.from({ length: 121 }, (_, messageIndex) => ({
          ...base.messages[0], id: `message-${messageIndex}`,
        })),
      })),
    });
    expect(result.threads).toHaveLength(80);
    expect(result.threads[0]?.messages).toHaveLength(120);
    expect(result.threads[0]?.messages[0]?.id).toBe('message-1');
    expect(result.activeThreadId).toBeNull();
  });
});
