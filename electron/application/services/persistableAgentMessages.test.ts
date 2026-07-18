import { describe, expect, it } from 'vitest';
import { persistableAgentMessages } from './persistableAgentMessages.js';

describe('persistableAgentMessages', () => {
  it('removes ephemeral local-file capabilities while keeping safe attachment context', () => {
    const messages = persistableAgentMessages([{
      id: 'message-1', sender: 'user', content: 'Review this', attachments: [{
        id: 'attachment-1', name: 'notes.txt', type: 'text', filePath: '/private/notes.txt',
        authorizationToken: 'ephemeral-token', mimeType: 'text/plain', size: 12,
      }],
    }]);

    expect(messages[0].attachments).toEqual([{
      id: 'attachment-1', name: 'notes.txt', type: 'text', mimeType: 'text/plain', size: 12,
    }]);
  });

  it('does not mutate the runtime message', () => {
    const message = {
      id: 'message-1', sender: 'user' as const, content: '',
      attachments: [{ id: 'attachment-1', name: 'a.txt', type: 'text' as const, filePath: '/tmp/a.txt' }],
    };
    persistableAgentMessages([message]);
    expect(message.attachments[0].filePath).toBe('/tmp/a.txt');
  });
});
