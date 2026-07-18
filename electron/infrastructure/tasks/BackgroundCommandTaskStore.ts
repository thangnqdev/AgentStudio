import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isTerminalBackgroundCommandStatus } from '../../domain/entities/backgroundCommand.js';
import {
  MAX_BACKGROUND_PROCESS_MESSAGE_BYTES,
  parseBackgroundCommandControl,
  parseBackgroundCommandProcessState,
  type BackgroundCommandProcessState,
} from './backgroundCommandProcessProtocol.js';

const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0;
const STATE_SUFFIX = '.state.json';
const CONTROL_SUFFIX = '.control.json';
const OUTPUT_SUFFIX = '.output';

export class BackgroundCommandTaskStore {
  private readonly directorySource: string | (() => string);

  constructor(directory: string | (() => string)) { this.directorySource = directory; }

  async prepare() {
    const directory = this.directory();
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Background task directory is unsafe.');
    await fs.chmod(directory, 0o700).catch(() => undefined);
    return await fs.realpath(directory);
  }

  async readState(taskId: string) {
    const filePath = this.taskPath(taskId, STATE_SUFFIX);
    let handle: Awaited<ReturnType<typeof fs.open>>;
    try { handle = await fs.open(filePath, constants.O_RDONLY | O_NOFOLLOW); }
    catch (error) { if (isMissing(error)) return null; throw error; }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_BACKGROUND_PROCESS_MESSAGE_BYTES) throw new Error('Background task state is unsafe.');
      return parseBackgroundCommandProcessState(JSON.parse(await handle.readFile('utf8')));
    } finally { await handle.close(); }
  }

  async writeState(state: BackgroundCommandProcessState) {
    const serialized = JSON.stringify(parseBackgroundCommandProcessState(state));
    if (Buffer.byteLength(serialized) > MAX_BACKGROUND_PROCESS_MESSAGE_BYTES) throw new Error('Background task state is too large.');
    await this.writeAtomic(this.taskPath(state.snapshot.id, STATE_SUFFIX), serialized);
  }

  async requestStop(taskId: string, token: string) {
    const payload = JSON.stringify(parseBackgroundCommandControl({ action: 'stop', token }));
    const filePath = this.taskPath(taskId, CONTROL_SUFFIX);
    try { await fs.writeFile(filePath, payload, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); }
    catch (error) { if (!isExists(error)) throw error; }
  }

  async consumeStop(taskId: string, expectedToken: string) {
    const filePath = this.taskPath(taskId, CONTROL_SUFFIX);
    let raw: string;
    try { raw = await readBoundedNoFollow(filePath); }
    catch (error) { if (isMissing(error)) return false; throw error; }
    await fs.rm(filePath, { force: true });
    const control = parseBackgroundCommandControl(JSON.parse(raw));
    return control.token === expectedToken;
  }

  async readOutputTail(taskId: string, maxBytes = 100_000) {
    const filePath = this.taskPath(taskId, OUTPUT_SUFFIX);
    let handle: Awaited<ReturnType<typeof fs.open>>;
    try { handle = await fs.open(filePath, constants.O_RDONLY | O_NOFOLLOW); }
    catch (error) { if (isMissing(error)) return ''; throw error; }
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error('Background task output is not a regular file.');
      const bytesToRead = Math.min(stat.size, Math.max(1, maxBytes));
      const buffer = Buffer.alloc(bytesToRead);
      const result = await handle.read(buffer, 0, bytesToRead, Math.max(0, stat.size - bytesToRead));
      return (stat.size > bytesToRead ? '[earlier background output omitted]\n' : '')
        + buffer.subarray(0, result.bytesRead).toString('utf8');
    } finally { await handle.close(); }
  }

  async listStates() {
    const directory = await this.prepare();
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const states = await Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(STATE_SUFFIX))
      .map((entry) => this.readState(entry.name.slice(0, -STATE_SUFFIX.length)).catch(() => null)));
    return states.filter((state): state is BackgroundCommandProcessState => Boolean(state));
  }

  async prune(maximum: number) {
    const states = (await this.listStates()).sort((a, b) => b.snapshot.startedAt.localeCompare(a.snapshot.startedAt));
    const removable = states.slice(maximum).filter((state) => isTerminalBackgroundCommandStatus(state.snapshot.status));
    await Promise.all(removable.flatMap((state) => [STATE_SUFFIX, CONTROL_SUFFIX, OUTPUT_SUFFIX]
      .map((suffix) => fs.rm(this.taskPath(state.snapshot.id, suffix), { force: true }).catch(() => undefined))));
  }

  outputPath(taskId: string) { return this.taskPath(taskId, OUTPUT_SUFFIX); }
  directory() {
    const value = typeof this.directorySource === 'function' ? this.directorySource() : this.directorySource;
    if (!value || !path.isAbsolute(value)) throw new Error('Background task directory is unavailable.');
    return value;
  }

  private taskPath(taskId: string, suffix: string) {
    if (!/^[a-zA-Z0-9-]{1,128}$/.test(taskId)) throw new Error('Background task ID is invalid.');
    return path.join(this.directory(), `${taskId}${suffix}`);
  }

  private async writeAtomic(filePath: string, contents: string) {
    const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    try { await fs.rename(temporary, filePath); }
    finally { await fs.rm(temporary, { force: true }).catch(() => undefined); }
  }
}

async function readBoundedNoFollow(filePath: string) {
  const handle = await fs.open(filePath, constants.O_RDONLY | O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 1_024) throw new Error('Background task control request is unsafe.');
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}
function isMissing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
function isExists(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'EEXIST'; }
