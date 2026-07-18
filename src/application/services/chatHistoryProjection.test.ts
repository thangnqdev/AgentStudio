import { describe, expect, it } from 'vitest';
import type { ChatThread } from '../../domain/entities/chatThread';
import { projectChatHistory } from './chatHistoryProjection';

describe('projectChatHistory', () => {
  it('never persists attachment paths, capabilities, previews or media bytes', () => {
    const now = new Date('2026-07-18');
    const threads: ChatThread[] = [{
      id: 'thread', title: 'Title', createdAt: now, updatedAt: now,
      messages: [{
        id: 'message', sender: 'user', content: 'inspect', timestamp: now,
        attachments: [{
          id: 'attachment', name: 'private.png', type: 'image', filePath: '/private/file',
          authorizationToken: 'secret-capability', previewUrl: 'blob:private',
          data: 'data:image/png;base64,secret', mimeType: 'image/png', size: 20,
        }],
      }],
    }];
    expect(projectChatHistory(threads)[0]?.messages[0]?.attachments).toEqual([
      { id: 'attachment', name: 'private.png', type: 'image', mimeType: 'image/png', size: 20 },
    ]);
  });

  it('bounds thread and per-thread message retention', () => {
    const now = new Date('2026-07-18');
    const threads: ChatThread[] = Array.from({ length: 81 }, (_, threadIndex) => ({
      id: `thread-${threadIndex}`, title: 'Title', createdAt: now, updatedAt: now,
      messages: Array.from({ length: 121 }, (_, messageIndex) => ({
        id: `message-${messageIndex}`, sender: 'user' as const, content: `${messageIndex}`, timestamp: now,
      })),
    }));
    const projected = projectChatHistory(threads);
    expect(projected).toHaveLength(80);
    expect(projected[0]?.messages).toHaveLength(120);
    expect(projected[0]?.messages[0]?.id).toBe('message-1');
  });
});
