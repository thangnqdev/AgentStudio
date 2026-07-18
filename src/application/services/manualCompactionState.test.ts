import { describe, expect, it } from 'vitest';
import type { Message } from '../../domain/entities/message';
import { buildManualCompactionMessages, isManualCompactionSnapshotCurrent, projectManualCompactionMessages } from './manualCompactionState';

const messages: Message[] = [
  {
    id: 'old', sender: 'user', content: 'old', timestamp: new Date('2026-01-01'),
    attachments: [{
      id: 'attachment', name: 'screen.png', type: 'image', data: 'data:image/png;base64,secret',
      authorizationToken: 'capability', previewUrl: 'blob:preview', mimeType: 'image/png', size: 12,
    }],
  },
  { id: 'recent', sender: 'agent', content: 'recent', timestamp: new Date('2026-01-02'), status: 'done' },
];

describe('manualCompactionState', () => {
  it('projects only text and non-authorizing attachment metadata across IPC', () => {
    expect(projectManualCompactionMessages(messages)).toEqual([
      {
        id: 'old', sender: 'user', content: 'old',
        attachments: [{ id: 'attachment', name: 'screen.png', type: 'image', mimeType: 'image/png', size: 12 }],
      },
      { id: 'recent', sender: 'agent', content: 'recent' },
    ]);
  });

  it('rejects stale thread snapshots even when message IDs would still match', () => {
    const snapshot = { activeThreadId: 'thread', messages };
    expect(isManualCompactionSnapshotCurrent(snapshot, snapshot)).toBe(true);
    expect(isManualCompactionSnapshotCurrent(snapshot, { ...snapshot, messages: [...messages] })).toBe(false);
    expect(isManualCompactionSnapshotCurrent(snapshot, { activeThreadId: 'other', messages })).toBe(false);
  });

  it('builds an agent-history summary and preserves selected recent objects in order', () => {
    const now = new Date('2026-07-18');
    const result = buildManualCompactionMessages(messages, {
      compacted: true, keptMessageIds: ['recent'], summary: 'local summary',
      originalApproxTokens: 20, compactedApproxTokens: 8,
    }, { createId: () => 'summary', now: () => now });
    expect(result).toEqual([
      { id: 'summary', sender: 'agent', content: 'local summary', timestamp: now, status: 'done', type: 'text' },
      messages[1],
    ]);
  });
});
