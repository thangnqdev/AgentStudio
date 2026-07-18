import type { Attachment } from './agent.js';

export const MAX_ATTACHMENT_AUTHORIZATIONS = 64;
export const ATTACHMENT_AUTHORIZATION_TTL_MS = 60 * 60 * 1_000;
export const MAX_DESCRIBED_MEDIA_BYTES = 100_000_000;

export type AttachmentAuthorizationRequest = {
  filePath: string;
  name: string;
  type: Attachment['type'];
  mimeType?: string;
  reportedSize?: number;
};

export type AuthorizedAttachment = Omit<Attachment, 'data' | 'authorizationToken'> & {
  filePath: string;
};

export type AttachmentAuthorizationGrant = Omit<AuthorizedAttachment, 'filePath'> & {
  authorizationToken: string;
};
