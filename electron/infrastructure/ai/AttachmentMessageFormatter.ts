import { constants } from 'node:fs';
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
      const content = await readRegularFile(attachment.filePath, MAX_FILE_BYTES);
      return `[File: ${attachment.name}]\nPath: ${attachment.filePath}\n\`\`\`\n${content.toString('utf8')}\n\`\`\``;
    } catch (error) {
      if (error instanceof AttachmentSizeError) {
        return `${this.describe(attachment)}\nFile is too large to inline (${error.size} bytes). Read it with tools only if needed.`;
      }
      return `${this.describe(attachment)}\nCould not read file: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  private async readImageUrl(attachment: Attachment) {
    if (attachment.data) return attachment.data;
    if (!attachment.filePath) return '';
    try {
      const mimeType = attachment.mimeType || this.inferMimeType(attachment.name) || 'image/png';
      return `data:${mimeType};base64,${(await readRegularFile(attachment.filePath, MAX_IMAGE_BYTES)).toString('base64')}`;
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

class AttachmentSizeError extends Error {
  readonly size: number;

  constructor(size: number) {
    super('Attachment exceeds its inline size limit.');
    this.size = size;
  }
}

async function readRegularFile(filePath: string, limit: number) {
  const linkStat = await fs.lstat(filePath);
  if (linkStat.isSymbolicLink()) throw new Error('Symbolic-link attachments are not allowed.');
  const handle = await fs.open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error('Path is not a regular file.');
    if (stat.size > limit) throw new AttachmentSizeError(stat.size);
    const buffer = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > limit) throw new AttachmentSizeError(offset);
    return buffer.subarray(0, offset);
  } finally {
    await handle.close();
  }
}
