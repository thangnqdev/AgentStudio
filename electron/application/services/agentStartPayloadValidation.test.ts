import { describe, expect, it } from 'vitest';
import { parseAgentStartPayload } from './agentStartPayloadValidation.js';

describe('parseAgentStartPayload', () => {
  it('returns an empty payload for an invalid IPC value', () => {
    expect(parseAgentStartPayload('invalid')).toEqual({});
  });

  it('keeps only valid messages and attachment fields', () => {
    expect(parseAgentStartPayload({
      requestId: 'request-1',
      taskId: 42,
      taskListId: 'thread-1',
      messages: [
        { id: 'message-1', sender: 'user', content: 'Hello', extra: 'drop-me', attachments: [
          { id: 'attachment-1', name: 'note.txt', type: 'text', data: 'content', filePath: '/forged/private-file', authorizationToken: 'picker-token', size: 7, extra: true },
          { id: 'attachment-2', name: 'bad', type: 'executable' },
        ], actions: [
          { id: 'tool-1', toolName: 'task_output', args: 'task_id', risk: 'read', status: 'ok', output: '<task_id>bg-1</task_id>', requestId: 'drop-me' },
          { id: 'tool-2', toolName: 'bad', args: '', risk: 'root', status: 'ok' },
          { id: 'tool-3', toolName: 'bad tool name', args: '', risk: 'read', status: 'ok' },
        ] },
        { id: 'message-2', sender: 'unknown', content: 'Ignore' },
      ],
    })).toEqual({
      requestId: 'request-1',
      taskId: undefined,
      taskListId: 'thread-1',
      messages: [{
        id: 'message-1',
        sender: 'user',
        content: 'Hello',
        attachments: [{
          id: 'attachment-1',
          name: 'note.txt',
          type: 'text',
          data: 'content',
          authorizationToken: 'picker-token',
          mimeType: undefined,
          size: 7,
        }],
        actions: [{
          id: 'tool-1',
          toolName: 'task_output',
          args: 'task_id',
          risk: 'read',
          status: 'ok',
          output: '<task_id>bg-1</task_id>',
        }],
      }],
    });
  });

  it('rejects task-list identities that could cross storage boundaries', () => {
    expect(parseAgentStartPayload({ taskListId: '../../other-thread' }).taskListId).toBeUndefined();
    expect(parseAgentStartPayload({ taskListId: 'thread:valid_1' }).taskListId).toBe('thread:valid_1');
  });

  it('drops oversized historical tool output at the IPC boundary', () => {
    const message = parseAgentStartPayload({ messages: [{
      id: 'message-1', sender: 'agent', content: 'done',
      actions: [{ id: 'tool-1', toolName: 'read_file', args: 'path=a', risk: 'read', status: 'ok', output: 'x'.repeat(120_001) }],
    }] }).messages?.[0];
    expect(message?.actions).toBeUndefined();
  });

  it('never accepts renderer-declared file paths or oversized inline attachment data', () => {
    const attachment = parseAgentStartPayload({ messages: [{
      id: 'message-1', sender: 'user', content: '', attachments: [{
        id: 'attachment-1', name: 'secret.txt', type: 'text',
        filePath: '/Users/victim/.ssh/id_ed25519', data: 'x'.repeat(200_001),
      }],
    }] }).messages?.[0].attachments?.[0];

    expect(attachment).toEqual({
      id: 'attachment-1', name: 'secret.txt', type: 'text', data: undefined,
      authorizationToken: undefined, mimeType: undefined, size: undefined,
    });
    expect(attachment).not.toHaveProperty('filePath');
  });
});
