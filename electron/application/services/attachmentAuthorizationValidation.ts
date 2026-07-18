import type { AttachmentAuthorizationRequest } from '../../domain/entities/attachmentAuthorization.js';

const MAX_PATH_CHARS = 4_096;
const MAX_NAME_CHARS = 512;
const MAX_MIME_CHARS = 200;

export function parseAttachmentAuthorizationRequest(value: unknown): AttachmentAuthorizationRequest | null {
  if (!isObject(value)) return null;
  const filePath = boundedString(value.filePath, MAX_PATH_CHARS);
  const name = boundedString(value.name, MAX_NAME_CHARS);
  const mimeType = value.mimeType === undefined ? undefined : boundedString(value.mimeType, MAX_MIME_CHARS);
  if (!filePath || !name || mimeType === null || !isAttachmentType(value.type)) return null;
  const reportedSize = value.reportedSize;
  if (reportedSize !== undefined && (!Number.isSafeInteger(reportedSize) || Number(reportedSize) < 0)) return null;
  return { filePath, name, type: value.type, mimeType: mimeType || undefined, reportedSize: reportedSize as number | undefined };
}

function boundedString(value: unknown, maxLength: number) {
  return typeof value === 'string' && !value.includes('\0') && value.length <= maxLength ? value : null;
}

function isAttachmentType(value: unknown): value is AttachmentAuthorizationRequest['type'] {
  return value === 'text' || value === 'image' || value === 'audio' || value === 'video';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
