import type { AgentStartPayload, Attachment, Message } from '../../domain/entities/agent.js';
import type {
  AttachmentAuthorizationGrant,
  AttachmentAuthorizationRequest,
} from '../../domain/entities/attachmentAuthorization.js';
import type { IAttachmentAuthorizationGateway } from '../../domain/ports/IAttachmentAuthorizationGateway.js';

export class ManageAttachmentAuthorizations {
  private readonly gateway: IAttachmentAuthorizationGateway;

  constructor(gateway: IAttachmentAuthorizationGateway) {
    this.gateway = gateway;
  }

  async authorize(input: AttachmentAuthorizationRequest): Promise<AttachmentAuthorizationGrant> {
    const { token, attachment } = await this.gateway.authorize(input);
    const { filePath: _filePath, ...publicAttachment } = attachment;
    return { ...publicAttachment, authorizationToken: token };
  }

  async resolvePayload(payload: AgentStartPayload): Promise<AgentStartPayload> {
    const messages = payload.messages ?? [];
    const latestUserIndex = messages.findLastIndex((message) => message.sender === 'user');
    const resolved: Message[] = [];
    for (let index = 0; index < messages.length; index += 1) {
      resolved.push(await this.resolveMessage(messages[index], index === latestUserIndex));
    }
    return { ...payload, messages: resolved };
  }

  clear() {
    this.gateway.clear();
  }

  private async resolveMessage(message: Message, latestUserMessage: boolean): Promise<Message> {
    if (!message.attachments?.length) return message;
    const attachments: Attachment[] = [];
    for (const attachment of message.attachments) {
      attachments.push(await this.resolveAttachment(attachment, latestUserMessage));
    }
    return { ...message, attachments };
  }

  private async resolveAttachment(attachment: Attachment, latestUserMessage: boolean): Promise<Attachment> {
    if (attachment.authorizationToken) {
      const authorized = await this.gateway.resolve(attachment.authorizationToken);
      if (authorized) return { ...authorized, id: attachment.id };
      if (latestUserMessage && !attachment.data) {
        throw new Error(`Attachment authorization expired or the file changed: ${attachment.name}. Reattach it and retry.`);
      }
    }
    if (latestUserMessage && (attachment.type === 'text' || attachment.type === 'image') && !attachment.data) {
      throw new Error(`Attachment was not authorized by the local file picker: ${attachment.name}. Reattach it and retry.`);
    }
    const { filePath: _filePath, authorizationToken: _token, ...metadata } = attachment;
    return metadata;
  }
}
