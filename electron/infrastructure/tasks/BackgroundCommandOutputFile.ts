import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0;
export const MAX_BACKGROUND_OUTPUT_BYTES = 5 * 1024 * 1024 * 1024;
const DEFAULT_READ_BYTES = 100_000;
const LIMIT_MARKER = '\n[background output truncated: 5GB limit exceeded]\n';

export class BackgroundCommandOutputFile {
  readonly outputPath: string;
  private readonly handle: Awaited<ReturnType<typeof fs.open>>;
  private pendingWrite: Promise<void> = Promise.resolve();
  private writeError: Error | undefined;
  private closed = false;
  outputBytes = 0;
  truncated = false;

  private constructor(outputPath: string, handle: Awaited<ReturnType<typeof fs.open>>) {
    this.outputPath = outputPath;
    this.handle = handle;
  }

  static async create(directory: string, taskId: string) {
    if (!/^[a-zA-Z0-9-]{1,128}$/.test(taskId)) throw new Error('Background task ID is invalid.');
    await ensurePrivateDirectory(directory);
    const outputPath = path.join(directory, `${taskId}.output`);
    const handle = await fs.open(
      outputPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | O_NOFOLLOW,
      0o600,
    );
    return new BackgroundCommandOutputFile(outputPath, handle);
  }

  append(chunk: Buffer | string) {
    if (this.closed || this.truncated || this.writeError) return false;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
    const exceedsLimit = this.outputBytes + buffer.byteLength > MAX_BACKGROUND_OUTPUT_BYTES;
    const next = exceedsLimit ? Buffer.from(LIMIT_MARKER, 'utf8') : buffer;
    this.outputBytes += next.byteLength;
    if (exceedsLimit) this.truncated = true;
    this.pendingWrite = this.pendingWrite
      .then(async () => { await this.handle.write(next); })
      .catch((error: unknown) => { this.writeError = asError(error); });
    return exceedsLimit;
  }

  async readTail(maxBytes = DEFAULT_READ_BYTES) {
    await this.flush();
    const handle = await fs.open(this.outputPath, constants.O_RDONLY | O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error('Background task output is not a regular file.');
      const bytesToRead = Math.min(stat.size, Math.max(1, maxBytes));
      const buffer = Buffer.alloc(bytesToRead);
      const { bytesRead } = await handle.read(buffer, 0, bytesToRead, Math.max(0, stat.size - bytesToRead));
      const prefix = stat.size > bytesToRead ? '[earlier background output omitted]\n' : '';
      return prefix + buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      await handle.close();
    }
  }

  async flush() {
    await this.pendingWrite;
    if (this.writeError) throw this.writeError;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.flush();
      await this.handle.sync();
    } finally {
      await this.handle.close();
    }
  }
}

async function ensurePrivateDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Background task output directory is unsafe.');
  await fs.chmod(directory, 0o700).catch(() => undefined);
}

function asError(error: unknown) {
  return error instanceof Error ? error : new Error('Unable to write background task output.');
}
