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
      messages: [
        { id: 'message-1', sender: 'user', content: 'Hello', extra: 'drop-me', attachments: [
          { id: 'attachment-1', name: 'note.txt', type: 'text', data: 'content', size: 7, extra: true },
          { id: 'attachment-2', name: 'bad', type: 'executable' },
        ] },
        { id: 'message-2', sender: 'unknown', content: 'Ignore' },
      ],
    })).toEqual({
      requestId: 'request-1',
      taskId: undefined,
      messages: [{
        id: 'message-1',
        sender: 'user',
        content: 'Hello',
        attachments: [{
          id: 'attachment-1',
          name: 'note.txt',
          type: 'text',
          data: 'content',
          filePath: undefined,
          mimeType: undefined,
          size: 7,
        }],
      }],
    });
  });
});
