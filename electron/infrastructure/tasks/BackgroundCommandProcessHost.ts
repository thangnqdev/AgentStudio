import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_BACKGROUND_PROCESS_MESSAGE_BYTES,
  parseBackgroundCommandProcessBootstrap,
  type BackgroundCommandProcessBootstrap,
} from './backgroundCommandProcessProtocol.js';

const START_TIMEOUT_MS = 5_000;
const SAFE_ENVIRONMENT_KEYS = [
  'PATH', 'HOME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TEMP', 'TMP',
  'TERM', 'USER', 'LOGNAME', 'SHELL', 'SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT',
] as const;

export class BackgroundCommandProcessHost {
  private readonly entryPath: string;
  private readonly runtimeArguments: string[];

  constructor(entryPath: string, runtimeArguments: string[] = []) {
    this.entryPath = path.resolve(entryPath);
    if (runtimeArguments.length > 4 || runtimeArguments.some((item) => !item || item.length > 4_000 || item.includes('\0'))) {
      throw new Error('Background command runtime arguments are invalid.');
    }
    this.runtimeArguments = [...runtimeArguments];
  }

  async start(rawBootstrap: BackgroundCommandProcessBootstrap, ready: () => Promise<boolean>) {
    const bootstrap = parseBackgroundCommandProcessBootstrap(rawBootstrap);
    const serialized = Buffer.from(JSON.stringify(bootstrap));
    if (serialized.byteLength > MAX_BACKGROUND_PROCESS_MESSAGE_BYTES) throw new Error('Background command bootstrap is too large.');
    const entry = await fs.realpath(this.entryPath);
    const stat = await fs.lstat(entry);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Background command process entrypoint is unsafe.');
    const child = spawn(process.execPath, [...this.runtimeArguments, entry], {
      cwd: bootstrap.command.cwd,
      detached: true,
      shell: false,
      windowsHide: true,
      env: { ...safeEnvironment(), ELECTRON_RUN_AS_NODE: '1', AGENTSTUDIO_BACKGROUND_BOOTSTRAP_FD: '3' },
      stdio: ['ignore', 'ignore', 'ignore', 'pipe'],
    });
    const channel = child.stdio[3];
    if (!channel || !('write' in channel)) { child.kill(); throw new Error('Background command bootstrap channel is unavailable.'); }
    const startupFailure = new Promise<never>((_, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => reject(new Error(`Background command supervisor exited during startup (code ${code ?? -1}).`)));
    });
    channel.end(serialized);
    serialized.fill(0);
    try { await Promise.race([waitUntilReady(ready), startupFailure]); }
    catch (error) { if (!await ready()) throw error; }
    finally {
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      child.unref();
      if ('unref' in channel && typeof channel.unref === 'function') channel.unref();
    }
  }
}

async function waitUntilReady(ready: () => Promise<boolean>) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Background command supervisor did not become ready.');
}

function safeEnvironment() {
  return Object.fromEntries(SAFE_ENVIRONMENT_KEYS.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]!]]));
}
