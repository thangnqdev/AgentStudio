import { describe, expect, it } from 'vitest';
import { parseAttachmentAuthorizationRequest } from './attachmentAuthorizationValidation.js';

describe('parseAttachmentAuthorizationRequest', () => {
  it('keeps only the bounded picker-derived contract', () => {
    expect(parseAttachmentAuthorizationRequest({
      filePath: '/workspace/note.txt', name: 'note.txt', type: 'text',
      mimeType: 'text/plain', reportedSize: 12, extra: 'drop',
    })).toEqual({
      filePath: '/workspace/note.txt', name: 'note.txt', type: 'text',
      mimeType: 'text/plain', reportedSize: 12,
    });
  });

  it('rejects malformed and unbounded input', () => {
    expect(parseAttachmentAuthorizationRequest({ filePath: '/a', name: 'a', type: 'executable' })).toBeNull();
    expect(parseAttachmentAuthorizationRequest({ filePath: `bad\0path`, name: 'a', type: 'text' })).toBeNull();
    expect(parseAttachmentAuthorizationRequest({ filePath: '/a', name: 'a', type: 'text', reportedSize: -1 })).toBeNull();
  });
});
