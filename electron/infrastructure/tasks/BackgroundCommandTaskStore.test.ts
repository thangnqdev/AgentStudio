import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BackgroundCommandTaskStore } from './BackgroundCommandTaskStore.js';
import type { BackgroundCommandProcessState } from './backgroundCommandProcessProtocol.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((item) => fs.rm(item, { recursive: true, force: true }))));

describe('BackgroundCommandTaskStore', () => {
  it('persists private state and consumes only the matching stop capability', async () => {
    const directory = await temporaryDirectory();
    const store = new BackgroundCommandTaskStore(directory);
    await store.prepare();
    const state = createState();
    await store.writeState(state);
    expect(await store.readState('bg-test')).toEqual(state);
    expect((await fs.stat(path.join(directory, 'bg-test.state.json'))).mode & 0o777).toBe(0o600);

    await store.requestStop('bg-test', 'b'.repeat(43));
    await expect(store.consumeStop('bg-test', state.controlToken)).resolves.toBe(false);
    await store.requestStop('bg-test', state.controlToken);
    await expect(store.consumeStop('bg-test', state.controlToken)).resolves.toBe(true);
  });

  it('refuses a symlinked state file', async () => {
    const directory = await temporaryDirectory();
    const store = new BackgroundCommandTaskStore(directory);
    await store.prepare();
    const target = path.join(directory, 'target.json');
    await fs.writeFile(target, JSON.stringify(createState()), 'utf8');
    try { await fs.symlink(target, path.join(directory, 'bg-test.state.json')); } catch { return; }
    await expect(store.readState('bg-test')).rejects.toThrow();
  });
});

async function temporaryDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-background-store-'));
  directories.push(directory);
  return directory;
}

function createState(): BackgroundCommandProcessState {
  return {
    version: 1,
    snapshot: {
      id: 'bg-test', scopeId: 'thread-1', command: 'npm test', description: 'Run tests',
      workspaceRoot: '/workspace', permissionMode: 'workspace-write', status: 'running',
      startedAt: '2026-07-18T00:00:00.000Z', exitCode: null, outputBytes: 0, outputTruncated: false,
    },
    timeoutAt: '2026-07-18T00:10:00.000Z', heartbeatAt: '2026-07-18T00:00:00.000Z',
    controlToken: 'a'.repeat(43), supervisorPid: 123,
  };
}
