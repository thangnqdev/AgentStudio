import type { Attachment } from '../../domain/entities/message';

export function formatContextWindow(tokens: number | undefined) {
  if (!tokens) return '';
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

export function estimateTextTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export function estimateAttachmentTokens(attachment: Pick<Attachment, 'name' | 'type' | 'data' | 'filePath' | 'mimeType' | 'size'>) {
  const metadataTokens = estimateTextTokens([
    attachment.name,
    attachment.type,
    attachment.filePath || '',
    attachment.mimeType || '',
    attachment.size || '',
  ].join(' '));

  if (attachment.type === 'text') {
    if (attachment.data) return metadataTokens + estimateTextTokens(attachment.data);
    if (attachment.size) return metadataTokens + Math.ceil(attachment.size / 4);
  }

  if (attachment.type === 'image') return metadataTokens + 1_000;
  if (attachment.type === 'audio' || attachment.type === 'video') return metadataTokens + 300;
  return metadataTokens;
}

export function estimateMessageTokens(message: {
  sender: 'user' | 'agent' | 'system';
  content: string;
  attachments?: Attachment[];
}) {
  const attachmentTokens = (message.attachments || []).reduce(
    (total, attachment) => total + estimateAttachmentTokens(attachment),
    0,
  );
  return estimateTextTokens(`${message.sender}\n${message.content}\n`) + attachmentTokens;
}

export function getContextUsageTone(percent: number) {
  if (percent >= 90) return { text: 'text-error', stroke: 'text-error' };
  if (percent >= 75) return { text: 'text-[#9C4326]', stroke: 'text-[#9C4326]' };
  return { text: 'text-on-surface-variant/70', stroke: 'text-secondary' };
}
