import { describe, expect, it } from 'vitest';
import type { AuthorizedAttachment } from '../../domain/entities/attachmentAuthorization.js';
import type { IAttachmentAuthorizationGateway } from '../../domain/ports/IAttachmentAuthorizationGateway.js';
import { ManageAttachmentAuthorizations } from './ManageAttachmentAuthorizations.js';

describe('ManageAttachmentAuthorizations', () => {
  it('returns an opaque grant and hides the trusted path from the renderer', async () => {
    const gateway = new FakeGateway();
    const useCase = new ManageAttachmentAuthorizations(gateway);
    const grant = await useCase.authorize({
      filePath: '/private/notes.txt', name: 'forged.txt', type: 'text', reportedSize: 5,
    });

    expect(grant).toEqual({
      id: 'trusted-id', name: 'notes.txt', type: 'text', mimeType: 'text/plain', size: 5,
      authorizationToken: 'opaque-token',
    });
    expect(grant).not.toHaveProperty('filePath');
  });

  it('resolves a current picker token to gateway-owned metadata and path', async () => {
    const useCase = new ManageAttachmentAuthorizations(new FakeGateway());
    const payload = await useCase.resolvePayload({ messages: [{
      id: 'message-1', sender: 'user', content: 'Read it', attachments: [{
        id: 'renderer-id', name: 'forged.txt', type: 'image', authorizationToken: 'opaque-token',
      }],
    }] });

    expect(payload.messages?.[0].attachments?.[0]).toEqual({
      id: 'renderer-id', name: 'notes.txt', type: 'text', filePath: '/private/notes.txt',
      mimeType: 'text/plain', size: 5,
    });
  });

  it('rejects an expired latest attachment and strips raw paths from history', async () => {
    const useCase = new ManageAttachmentAuthorizations(new FakeGateway(false));
    await expect(useCase.resolvePayload({ messages: [{
      id: 'message-1', sender: 'user', content: '', attachments: [{
        id: 'attachment-1', name: 'secret.txt', type: 'text', authorizationToken: 'expired',
      }],
    }] })).rejects.toThrow('Reattach');

    const history = await useCase.resolvePayload({ messages: [
      { id: 'old', sender: 'user', content: '', attachments: [{ id: 'old-a', name: 'old.txt', type: 'text', filePath: '/forged/path' }] },
      { id: 'new', sender: 'user', content: 'Continue' },
    ] });
    expect(history.messages?.[0].attachments?.[0]).not.toHaveProperty('filePath');
  });
});

class FakeGateway implements IAttachmentAuthorizationGateway {
  private readonly available: boolean;

  constructor(available = true) {
    this.available = available;
  }

  async authorize() {
    return { token: 'opaque-token', attachment: trustedAttachment() };
  }

  async resolve() {
    return this.available ? trustedAttachment() : null;
  }

  clear() {}
}

function trustedAttachment(): AuthorizedAttachment {
  return {
    id: 'trusted-id', name: 'notes.txt', type: 'text', filePath: '/private/notes.txt',
    mimeType: 'text/plain', size: 5,
  };
}
