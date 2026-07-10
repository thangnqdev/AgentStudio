import fs from 'node:fs/promises';
import path from 'node:path';
import type { Attachment, ChatMessage, Message } from '../../domain/entities/agent.js';
import type { IAttachmentMessageFormatter } from '../../domain/ports/IAttachmentMessageFormatter.js';
import { MAX_FILE_BYTES, MAX_IMAGE_BYTES } from '../../domain/entities/limits.js';

export class AttachmentMessageFormatter implements IAttachmentMessageFormatter {
  async format(messages: Message[]): Promise<ChatMessage[]> {
    const formattedMessages: ChatMessage[] = [];
    for (const message of messages) {
      if (!message.attachments?.length) {
        formattedMessages.push({ role: message.sender === 'user' ? 'user' : 'assistant', content: message.content });
        continue;
      }
      const parts: Array<Record<string, unknown>> = [];
      for (const attachment of message.attachments) {
        if (attachment.type === 'image') {
          const imageUrl = await this.readImageUrl(attachment);
          parts.push(imageUrl ? { type: 'image_url', image_url: { url: imageUrl } } : { type: 'text', text: this.describe(attachment) });
        } else if (attachment.type === 'text') {
          parts.push({ type: 'text', text: await this.readText(attachment) });
        } else {
          parts.push({ type: 'text', text: this.describe(attachment) });
        }
      }
      if (message.content) parts.push({ type: 'text', text: message.content });
      formattedMessages.push({ role: message.sender === 'user' ? 'user' : 'assistant', content: parts });
    }
    return formattedMessages;
  }

  private async readText(attachment: Attachment) {
    if (attachment.data) return `[File: ${attachment.name}]\n\`\`\`\n${attachment.data}\n\`\`\``;
    if (!attachment.filePath) return this.describe(attachment);
    try {
      const stat = await fs.stat(attachment.filePath);
      if (!stat.isFile()) return `${this.describe(attachment)}\nPath is not a file.`;
      if (stat.size > MAX_FILE_BYTES) return `${this.describe(attachment)}\nFile is too large to inline (${stat.size} bytes). Read it with tools only if needed.`;
      return `[File: ${attachment.name}]\nPath: ${attachment.filePath}\n\`\`\`\n${await fs.readFile(attachment.filePath, 'utf8')}\n\`\`\``;
    } catch (error) {
      return `${this.describe(attachment)}\nCould not read file: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  private async readImageUrl(attachment: Attachment) {
    if (attachment.data) return attachment.data;
    if (!attachment.filePath) return '';
    try {
      const stat = await fs.stat(attachment.filePath);
      if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) return '';
      const mimeType = attachment.mimeType || this.inferMimeType(attachment.name) || 'image/png';
      return `data:${mimeType};base64,${(await fs.readFile(attachment.filePath)).toString('base64')}`;
    } catch {
      return '';
    }
  }

  private describe(attachment: Attachment) {
    return [`[${attachment.type} attachment: ${attachment.name}]`, attachment.filePath ? `Path: ${attachment.filePath}` : '', attachment.size ? `Size: ${attachment.size} bytes` : '', attachment.mimeType ? `MIME: ${attachment.mimeType}` : ''].filter(Boolean).join('\n');
  }

  private inferMimeType(fileName: string) {
    const extension = path.extname(fileName).toLowerCase();
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
    if (extension === '.png') return 'image/png';
    if (extension === '.gif') return 'image/gif';
    return extension === '.webp' ? 'image/webp' : '';
  }
}
