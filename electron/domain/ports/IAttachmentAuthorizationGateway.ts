import type {
  AttachmentAuthorizationRequest,
  AuthorizedAttachment,
} from '../entities/attachmentAuthorization.js';

export interface IAttachmentAuthorizationGateway {
  authorize(input: AttachmentAuthorizationRequest): Promise<{ token: string; attachment: AuthorizedAttachment }>;
  resolve(token: string): Promise<AuthorizedAttachment | null>;
  clear(): void;
}
