import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AttachmentAuthorizationRequest,
  AuthorizedAttachment,
} from '../../domain/entities/attachmentAuthorization.js';
import {
  ATTACHMENT_AUTHORIZATION_TTL_MS,
  MAX_ATTACHMENT_AUTHORIZATIONS,
  MAX_DESCRIBED_MEDIA_BYTES,
} from '../../domain/entities/attachmentAuthorization.js';
import { MAX_FILE_BYTES, MAX_IMAGE_BYTES } from '../../domain/entities/limits.js';
import type { IAttachmentAuthorizationGateway } from '../../domain/ports/IAttachmentAuthorizationGateway.js';

type Fingerprint = { dev: bigint; ino: bigint; size: number; mtimeMs: number };
type AuthorizationRecord = {
  attachment: AuthorizedAttachment;
  fingerprint: Fingerprint;
  expiresAt: number;
  createdAt: number;
};

export class EphemeralAttachmentAuthorizationGateway implements IAttachmentAuthorizationGateway {
  private readonly records = new Map<string, AuthorizationRecord>();

  async authorize(input: AttachmentAuthorizationRequest) {
    const filePath = validateAbsolutePath(input.filePath);
    const fingerprint = await inspectRegularFile(filePath);
    validateSize(input.type, fingerprint.size);
    if (input.reportedSize !== undefined && input.reportedSize !== fingerprint.size) {
      throw new Error('The selected file changed before it could be authorized. Select it again.');
    }

    this.prune();
    const token = randomUUID();
    const attachment: AuthorizedAttachment = {
      id: token,
      name: path.basename(filePath),
      type: input.type,
      filePath,
      mimeType: normalizeMimeType(input.mimeType),
      size: fingerprint.size,
    };
    this.records.set(token, {
      attachment,
      fingerprint,
      createdAt: Date.now(),
      expiresAt: Date.now() + ATTACHMENT_AUTHORIZATION_TTL_MS,
    });
    this.enforceCapacity();
    return { token, attachment: { ...attachment } };
  }

  async resolve(token: string) {
    this.prune();
    const record = this.records.get(token);
    if (!record) return null;
    try {
      const current = await inspectRegularFile(record.attachment.filePath);
      if (!sameFingerprint(current, record.fingerprint)) {
        this.records.delete(token);
        return null;
      }
      return { ...record.attachment };
    } catch {
      this.records.delete(token);
      return null;
    }
  }

  clear() { this.records.clear(); }

  private prune() {
    const now = Date.now();
    for (const [token, record] of this.records) {
      if (record.expiresAt <= now) this.records.delete(token);
    }
  }

  private enforceCapacity() {
    if (this.records.size <= MAX_ATTACHMENT_AUTHORIZATIONS) return;
    const oldest = [...this.records.entries()].sort((left, right) => left[1].createdAt - right[1].createdAt);
    for (const [token] of oldest.slice(0, this.records.size - MAX_ATTACHMENT_AUTHORIZATIONS)) {
      this.records.delete(token);
    }
  }
}

async function inspectRegularFile(filePath: string): Promise<Fingerprint> {
  const linkStat = await fs.lstat(filePath, { bigint: true });
  if (linkStat.isSymbolicLink()) throw new Error('Symbolic-link attachments are not allowed.');
  const handle = await fs.open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat({ bigint: true });
    if (!stat.isFile()) throw new Error('The selected path is not a regular file.');
    return { dev: stat.dev, ino: stat.ino, size: Number(stat.size), mtimeMs: Number(stat.mtimeMs) };
  } finally {
    await handle.close();
  }
}

function validateAbsolutePath(value: string) {
  if (!value || value.includes('\0') || !path.isAbsolute(value)) throw new Error('The selected file path is invalid.');
  return path.resolve(value);
}

function validateSize(type: AttachmentAuthorizationRequest['type'], size: number) {
  const limit = type === 'image' ? MAX_IMAGE_BYTES : type === 'text' ? MAX_FILE_BYTES : MAX_DESCRIBED_MEDIA_BYTES;
  if (size <= 0) throw new Error('Empty files cannot be attached.');
  if (size > limit) throw new Error(`The selected ${type} file is too large (${size} bytes; limit ${limit} bytes).`);
}

function normalizeMimeType(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(normalized)
    ? normalized.slice(0, 200)
    : undefined;
}

function sameFingerprint(left: Fingerprint, right: Fingerprint) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeMs === right.mtimeMs;
}
