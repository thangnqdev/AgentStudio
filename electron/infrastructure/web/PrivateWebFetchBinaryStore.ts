import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IWebBinaryStore } from '../../domain/ports/IWebBinaryStore.js';

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_MAX_FILES = 200;
const DEFAULT_MAX_TOTAL_BYTES = 100 * 1024 * 1024;

type StoredBinary = { path: string; mtimeMs: number; size: number };

export class PrivateWebFetchBinaryStore implements IWebBinaryStore {
  private readonly resolveDirectory: () => string;
  private readonly maxAgeMs: number;
  private readonly maxFiles: number;
  private readonly maxTotalBytes: number;
  private readonly now: () => number;

  constructor(resolveDirectory: () => string, options: {
    maxAgeMs?: number; maxFiles?: number; maxTotalBytes?: number; now?: () => number;
  } = {}) {
    this.resolveDirectory = resolveDirectory;
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
    this.maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
    this.now = options.now ?? Date.now;
  }

  async persist(input: Parameters<IWebBinaryStore['persist']>[0]) {
    if (input.body.byteLength > this.maxTotalBytes) throw new Error('WebFetch binary exceeds the private storage quota.');
    const directory = this.resolveDirectory();
    await ensurePrivateDirectory(directory);
    await this.ensureCapacity(directory, input.body.byteLength);
    const target = path.join(directory, `webfetch-${randomUUID()}${extensionFor(input.contentType)}`);
    const handle = await fs.open(
      target,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    try {
      await handle.writeFile(input.body);
    } finally {
      await handle.close();
    }
    return { path: target, size: input.body.byteLength };
  }

  private async ensureCapacity(directory: string, incomingBytes: number) {
    const cutoff = this.now() - this.maxAgeMs;
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    const stored = (await Promise.all(entries.flatMap(async (entry) => {
      if (!entry.isFile() || !entry.name.startsWith('webfetch-')) return [];
      const target = path.join(directory, entry.name);
      const stat = await fs.lstat(target).catch(() => undefined);
      return stat?.isFile() ? [{ path: target, mtimeMs: stat.mtimeMs, size: stat.size }] : [];
    }))).flat().sort((left, right) => left.mtimeMs - right.mtimeMs || left.path.localeCompare(right.path));
    const retained: StoredBinary[] = [];
    for (const item of stored) {
      if (item.mtimeMs < cutoff) await fs.rm(item.path, { force: true });
      else retained.push(item);
    }
    let totalBytes = retained.reduce((sum, item) => sum + item.size, 0);
    while (retained.length >= this.maxFiles || totalBytes + incomingBytes > this.maxTotalBytes) {
      const oldest = retained.shift();
      if (!oldest) throw new Error('WebFetch binary storage quota cannot be satisfied.');
      await fs.rm(oldest.path, { force: true });
      totalBytes -= oldest.size;
    }
  }
}

async function ensurePrivateDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('WebFetch binary directory is not a private directory.');
  await fs.chmod(directory, 0o700);
}

function extensionFor(contentType: string) {
  const mime = contentType.split(';', 1)[0].trim().toLowerCase();
  return ({
    'application/pdf': '.pdf', 'application/zip': '.zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/msword': '.doc', 'application/vnd.ms-excel': '.xls',
    'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/ogg': '.ogg',
    'video/mp4': '.mp4', 'video/webm': '.webm',
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp',
    'application/octet-stream': '.bin',
  } as Record<string, string>)[mime] ?? '.bin';
}
