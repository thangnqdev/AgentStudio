import { ManageAttachmentAuthorizations } from './application/usecases/ManageAttachmentAuthorizations.js';
import { EphemeralAttachmentAuthorizationGateway } from './infrastructure/attachments/EphemeralAttachmentAuthorizationGateway.js';

export const attachmentAuthorizations = new ManageAttachmentAuthorizations(
  new EphemeralAttachmentAuthorizationGateway(),
);
