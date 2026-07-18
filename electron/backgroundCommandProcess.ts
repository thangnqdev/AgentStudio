import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { BackgroundCommandOutputFile } from './infrastructure/tasks/BackgroundCommandOutputFile.js';
import { BackgroundCommandTaskStore } from './infrastructure/tasks/BackgroundCommandTaskStore.js';
import {
  MAX_BACKGROUND_PROCESS_MESSAGE_BYTES,
  parseBackgroundCommandProcessBootstrap,
  type BackgroundCommandProcessState,
} from './infrastructure/tasks/backgroundCommandProcessProtocol.js';
import { buildSafeProcessEnvironment, terminateProcessTree } from './infrastructure/tools/sandbox/ProcessTree.js';

const HEARTBEAT_INTERVAL_MS = 1_000;
const CONTROL_INTERVAL_MS = 100;
const FORCE_KILL_DELAY_MS = 5_000;

const bootstrap = await readBootstrap();
const store = new BackgroundCommandTaskStore(bootstrap.directory);
await store.prepare();
const output = await BackgroundCommandOutputFile.create(bootstrap.directory, bootstrap.state.snapshot.id);
const state: BackgroundCommandProcessState = {
  ...bootstrap.state,
  heartbeatAt: new Date().toISOString(),
  supervisorPid: process.pid,
};
let child: ChildProcess | undefined;
let terminationReason: 'timeout' | 'output_limit' | 'stopped' | 'supervisor_failure' | undefined;
let forceKillTimer: NodeJS.Timeout | undefined;
let finalized = false;
let writeQueue = Promise.resolve();

try {
  child = spawn(bootstrap.command.executable, bootstrap.command.args, {
    cwd: bootstrap.command.cwd,
    env: buildSafeProcessEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    shell: false,
    windowsHide: true,
  });
} catch (error) {
  state.snapshot.error = errorMessage(error);
  state.snapshot.status = 'failed';
  state.snapshot.endedAt = new Date().toISOString();
  await output.close();
  await store.writeState(state);
  process.exitCode = 1;
}

if (child) {
  await persist();
  child.stdout?.on('data', (chunk: Buffer) => append(chunk));
  child.stderr?.on('data', (chunk: Buffer) => append(chunk));
  child.once('error', (error) => { void finalize(null, errorMessage(error)); });
  child.once('close', (code) => { void finalize(code, undefined); });

  const heartbeat = setInterval(() => {
    state.heartbeatAt = new Date().toISOString();
    state.snapshot.outputBytes = output.outputBytes;
    state.snapshot.outputTruncated = output.truncated;
    void persist().catch((error) => requestTermination('supervisor_failure', errorMessage(error)));
  }, HEARTBEAT_INTERVAL_MS);
  const control = setInterval(() => {
    void store.consumeStop(state.snapshot.id, state.controlToken).then((stop) => {
      if (!stop) return;
      requestTermination('stopped');
    }).catch((error) => requestTermination('supervisor_failure', errorMessage(error)));
  }, CONTROL_INTERVAL_MS);
  const timeout = setTimeout(
    () => requestTermination('timeout'),
    Math.max(1, Date.parse(state.timeoutAt) - Date.now()),
  );
  const stopFromSignal = () => requestTermination('supervisor_failure', 'Background command supervisor was interrupted.');
  process.once('SIGTERM', stopFromSignal);
  process.once('SIGINT', stopFromSignal);
  await new Promise<void>((resolve) => child?.once('close', () => resolve()));
  clearInterval(heartbeat);
  clearInterval(control);
  clearTimeout(timeout);
  process.removeListener('SIGTERM', stopFromSignal);
  process.removeListener('SIGINT', stopFromSignal);
}

function append(chunk: Buffer) {
  if (output.append(chunk)) requestTermination('output_limit');
}

function requestTermination(reason: typeof terminationReason, detail?: string) {
  if (!child || terminationReason || finalized) return;
  terminationReason = reason;
  if (reason !== 'stopped') {
    state.snapshot.error = detail || (reason === 'timeout'
      ? 'Background command timed out.'
      : reason === 'output_limit'
        ? 'Background command exceeded the output limit.'
        : 'Background command supervisor failed.');
  }
  terminateProcessTree(child.pid, 'SIGTERM');
  forceKillTimer = setTimeout(() => terminateProcessTree(child?.pid, 'SIGKILL'), FORCE_KILL_DELAY_MS);
  forceKillTimer.unref();
}

async function finalize(exitCode: number | null, spawnError?: string) {
  if (finalized) return;
  finalized = true;
  if (forceKillTimer) clearTimeout(forceKillTimer);
  state.snapshot.exitCode = exitCode;
  state.snapshot.outputBytes = output.outputBytes;
  state.snapshot.outputTruncated = output.truncated;
  state.snapshot.endedAt ||= new Date().toISOString();
  if (terminationReason === 'stopped') state.snapshot.status = 'stopped';
  else if (terminationReason || spawnError || exitCode !== 0) state.snapshot.status = 'failed';
  else state.snapshot.status = 'completed';
  if (spawnError) state.snapshot.error = spawnError;
  try { await output.close(); }
  catch { state.snapshot.error ||= 'Unable to finalize background command output.'; state.snapshot.status = 'failed'; }
  state.heartbeatAt = new Date().toISOString();
  await persist();
}

function persist() {
  const snapshot = structuredClone(state);
  writeQueue = writeQueue.catch(() => undefined).then(() => store.writeState(snapshot));
  return writeQueue;
}

async function readBootstrap() {
  const rawFd = process.env.AGENTSTUDIO_BACKGROUND_BOOTSTRAP_FD;
  delete process.env.AGENTSTUDIO_BACKGROUND_BOOTSTRAP_FD;
  if (!rawFd || !/^\d+$/.test(rawFd)) throw new Error('Background command bootstrap descriptor is invalid.');
  const fd = Number(rawFd); const chunks: Buffer[] = []; let total = 0;
  while (true) {
    const buffer = Buffer.allocUnsafe(16 * 1_024);
    const count = fs.readSync(fd, buffer, 0, buffer.length, null);
    if (count === 0) break;
    total += count;
    if (total > MAX_BACKGROUND_PROCESS_MESSAGE_BYTES) throw new Error('Background command bootstrap is too large.');
    chunks.push(buffer.subarray(0, count));
  }
  const serialized = Buffer.concat(chunks, total);
  try { return parseBackgroundCommandProcessBootstrap(JSON.parse(serialized.toString('utf8'))); }
  finally { serialized.fill(0); for (const chunk of chunks) chunk.fill(0); }
}

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : 'Background command process failed.').slice(0, 2_000);
}
