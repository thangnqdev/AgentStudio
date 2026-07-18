import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import {
  MAX_MCP_ARTIFACT_OFFSET_CHARACTERS,
  MAX_MCP_ARTIFACT_READ_CHARACTERS,
  MAX_MCP_RESOURCE_BLOB_BYTES,
} from '../../domain/entities/mcpResource.js';
import type { IMcpResourceArtifactStore } from '../../domain/ports/IMcpResourceArtifactStore.js';

const MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_SAVED_TOOL_RESULT_BYTES = 20 * 1024 * 1024;
const MAX_STORED_BYTES = 512 * 1024 * 1024;
const MAX_STORED_FILES = 500;

export class PrivateMcpResourceArtifactStore implements IMcpResourceArtifactStore {
  private readonly resolveDirectory: () => string;
  private readonly ownedTextArtifacts = new Set<string>();
  private queue = Promise.resolve();

  constructor(resolveDirectory: () => string) { this.resolveDirectory = resolveDirectory; }

  async persistBase64(input: { base64: string; mimeType?: string }) {
    const body = decodeBase64(input.base64);
    if (body.byteLength > MAX_MCP_RESOURCE_BLOB_BYTES) throw new Error('binary resource exceeds the 25 MiB limit');
    return this.persist(body, `mcp-resource-${randomUUID()}${extensionFor(input.mimeType)}`);
  }

  async persistToolResult(input: { content: string }) {
    const body = Buffer.from(input.content, 'utf8');
    if (body.byteLength > MAX_SAVED_TOOL_RESULT_BYTES) throw new Error('MCP resource tool result exceeds the 20 MiB persistence limit.');
    return this.persist(body, `mcp-tool-result-${randomUUID()}.json`);
  }

  canReadTextArtifact(candidatePath: string) {
    if (!candidatePath || candidatePath !== path.resolve(candidatePath)) return false;
    const directory = path.resolve(this.resolveDirectory());
    return path.dirname(candidatePath) === directory
      && isTextArtifactFilename(path.basename(candidatePath))
      && this.ownedTextArtifacts.has(candidatePath);
  }

  async readTextArtifact(input: { path: string; offset: number; limit: number }) {
    validateReadRange(input.offset, input.limit);
    if (!this.canReadTextArtifact(input.path)) throw new Error('Path is not an owned MCP text artifact.');
    await ensurePrivateDirectory(path.resolve(this.resolveDirectory()));
    const handle = await fs.open(input.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error('MCP artifact path is not a regular file.');
      if (stat.size > MAX_MCP_RESOURCE_BLOB_BYTES) throw new Error('MCP text artifact exceeds the 25 MiB read limit.');
      const buffer = Buffer.allocUnsafe(stat.size);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const result = await handle.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
        if (result.bytesRead === 0) break;
        bytesRead += result.bytesRead;
      }
      const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead));
      const offset = Math.min(input.offset, content.length);
      const end = Math.min(offset + input.limit, content.length);
      return {
        content: content.slice(offset, end), offset,
        ...(end < content.length ? { nextOffset: end } : {}),
        totalCharacters: content.length,
      };
    } finally {
      await handle.close();
    }
  }

  private async persist(body: Buffer, filename: string) {
    const operation = this.queue.then(() => this.persistLocked(body, filename));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async persistLocked(body: Buffer, filename: string) {
    const directory = path.resolve(this.resolveDirectory());
    await ensurePrivateDirectory(directory);
    await this.makeRoom(directory, body.byteLength);
    const target = path.join(directory, filename);
    const handle = await fs.open(
      target,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    try {
      await handle.writeFile(body);
    } finally {
      await handle.close();
    }
    if (isTextArtifactFilename(filename)) this.ownedTextArtifacts.add(target);
    return { path: target, size: body.byteLength };
  }

  private async makeRoom(directory: string, incomingBytes: number) {
    const cutoff = Date.now() - MAX_AGE_MS;
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    const artifacts = (await Promise.all(entries.map(async (entry) => {
      if (!entry.isFile() || (!entry.name.startsWith('mcp-resource-') && !entry.name.startsWith('mcp-tool-result-'))) return undefined;
      const target = path.join(directory, entry.name);
      const stat = await fs.lstat(target).catch(() => undefined);
      return stat && !stat.isSymbolicLink() ? { target, size: stat.size, mtimeMs: stat.mtimeMs } : undefined;
    }))).filter((item): item is { target: string; size: number; mtimeMs: number } => Boolean(item));
    const expired = artifacts.filter((item) => item.mtimeMs < cutoff);
    await Promise.all(expired.map(async (item) => {
      await fs.rm(item.target, { force: true });
      this.ownedTextArtifacts.delete(item.target);
    }));
    const active = artifacts.filter((item) => item.mtimeMs >= cutoff).sort((left, right) => left.mtimeMs - right.mtimeMs);
    let totalBytes = active.reduce((sum, item) => sum + item.size, 0);
    while (active.length >= MAX_STORED_FILES || totalBytes + incomingBytes > MAX_STORED_BYTES) {
      const oldest = active.shift();
      if (!oldest) throw new Error('MCP resource artifact quota is exhausted.');
      await fs.rm(oldest.target, { force: true });
      this.ownedTextArtifacts.delete(oldest.target);
      totalBytes -= oldest.size;
    }
  }
}

async function ensurePrivateDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('MCP resource artifact directory is not a private directory.');
  await fs.chmod(directory, 0o700);
}

function decodeBase64(value: string) {
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('binary resource is not valid base64');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) throw new Error('binary resource is not canonical base64');
  return decoded;
}

function extensionFor(value: string | undefined) {
  const mime = (value || '').split(';', 1)[0].trim().toLowerCase();
  return ({
    'application/pdf': '.pdf', 'application/json': '.json', 'application/zip': '.zip',
    'text/plain': '.txt', 'text/csv': '.csv', 'text/html': '.html', 'text/markdown': '.md',
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp',
    'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'video/mp4': '.mp4',
  } as Record<string, string>)[mime] ?? '.bin';
}

function isTextArtifactFilename(filename: string) {
  return /^(?:mcp-tool-result|mcp-resource)-.+\.(?:json|txt|csv|html|md)$/.test(filename);
}

function validateReadRange(offset: number, limit: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_MCP_ARTIFACT_OFFSET_CHARACTERS) {
    throw new Error(`offset must be an integer between 0 and ${MAX_MCP_ARTIFACT_OFFSET_CHARACTERS}.`);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MCP_ARTIFACT_READ_CHARACTERS) {
    throw new Error(`limit must be an integer between 1 and ${MAX_MCP_ARTIFACT_READ_CHARACTERS}.`);
  }
}
