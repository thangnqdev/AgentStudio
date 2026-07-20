import { describe, expect, it } from 'vitest';
import type { ChatThread } from '../../domain/entities/chatThread';
import type { Message } from '../../domain/entities/message';
import { findRetryUserMessage, syncActiveThread } from './chatThreadState';

const NOW = new Date('2026-07-14T10:00:00.000Z');

function message(content: string): Message {
  return {
    id: 'message-1',
    sender: 'user',
    content,
    timestamp: NOW,
    status: 'done',
  };
}

describe('syncActiveThread', () => {
  it('creates a thread when no active thread exists', () => {
    const messages = [message('Lập kế hoạch phát hành')];
    const result = syncActiveThread(
      { messages: [], threads: [], activeThreadId: null, activeTask: null },
      messages,
      { createId: () => 'thread-1', now: () => NOW },
    );

    expect(result.activeThreadId).toBe('thread-1');
    expect(result.activeTask).toBe('Lập kế hoạch phát hành');
    expect(result.threads).toEqual([{
      id: 'thread-1',
      title: 'Lập kế hoạch phát hành',
      messages,
      createdAt: NOW,
      updatedAt: NOW,
    }]);
  });

  it('updates the active thread without changing its creation time', () => {
    const createdAt = new Date('2026-07-01T00:00:00.000Z');
    const existing: ChatThread = {
      id: 'thread-1',
      title: 'Chat mới',
      messages: [],
      createdAt,
      updatedAt: createdAt,
    };
    const messages = [message('Phân tích mục tiêu quý')];
    const result = syncActiveThread(
      { messages: [], threads: [existing], activeThreadId: existing.id, activeTask: existing.title },
      messages,
      { createId: () => 'unused', now: () => NOW },
    );

    expect(result.threads).toHaveLength(1);
    expect(result.threads[0].createdAt).toEqual(createdAt);
    expect(result.threads[0].updatedAt).toEqual(NOW);
    expect(result.threads[0].messages).toBe(messages);
  });

  it('preserves a custom session title when later messages are synchronized', () => {
    const existing: ChatThread = {
      id: 'thread-1', title: 'Release investigation', customTitle: true, messages: [],
      createdAt: NOW, updatedAt: NOW,
    };
    const result = syncActiveThread(
      { messages: [], threads: [existing], activeThreadId: existing.id, activeTask: existing.title },
      [message('A different automatically derived title')],
      { createId: () => 'unused', now: () => NOW },
    );
    expect(result.activeTask).toBe('Release investigation');
    expect(result.threads[0]).toMatchObject({ title: 'Release investigation', customTitle: true });
  });
});

describe('findRetryUserMessage', () => {
  it('finds the user request immediately preceding a failed agent response', () => {
    const user = message('Sửa giao diện tool');
    const messages: Message[] = [
      user,
      { id: 'system-1', sender: 'system', content: 'Đang xử lý', timestamp: NOW },
      { id: 'agent-1', sender: 'agent', content: 'Lỗi', timestamp: NOW, status: 'error' },
    ];

    expect(findRetryUserMessage(messages, 'agent-1')).toBe(user);
  });

  it('does not retry an unknown or non-agent message', () => {
    const messages = [message('Không chạy lại')];
    expect(findRetryUserMessage(messages, 'message-1')).toBeNull();
    expect(findRetryUserMessage(messages, 'missing')).toBeNull();
  });
});
