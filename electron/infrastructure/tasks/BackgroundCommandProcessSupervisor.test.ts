import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BackgroundCommandProcessSupervisor } from './BackgroundCommandProcessSupervisor.js';

const directories: string[] = [];
const supervisors: BackgroundCommandProcessSupervisor[] = [];

afterEach(async () => {
  await Promise.allSettled(supervisors.splice(0).map((supervisor) => supervisor.stopAll()));
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe.skipIf(process.platform === 'win32')('BackgroundCommandProcessSupervisor', () => {
  it('streams bounded output and waits for a background process to complete', async () => {
    const supervisor = await createSupervisor();
    const task = await supervisor.start(input('printf start; sleep 0.05; printf end'));
    const current = await supervisor.output('thread-1', task.id, { block: false, timeoutMs: 0 });
    expect(current?.retrievalStatus === 'not_ready' || current?.retrievalStatus === 'success').toBe(true);

    const completed = await supervisor.output('thread-1', task.id, { block: true, timeoutMs: 2_000 });
    expect(completed).toMatchObject({ retrievalStatus: 'success', task: { status: 'completed', exitCode: 0 } });
    expect(completed?.output).toContain('start');
    expect(completed?.output).toContain('end');
  });

  it('scopes task access to one chat and stops the complete process tree', async () => {
    const supervisor = await createSupervisor();
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-background-workspace-'));
    directories.push(workspace);
    const pidFile = path.join(workspace, 'child.pid');
    const task = await supervisor.start(input('echo $$ > child.pid; while true; do printf tick; sleep 0.05; done', workspace));
    await waitForFile(pidFile);
    expect(await supervisor.output('other-thread', task.id, { block: false, timeoutMs: 0 })).toBeNull();
    const stopped = await supervisor.stop('thread-1', task.id);
    expect(stopped?.status).toBe('stopped');
    await expect(supervisor.stop('thread-1', task.id)).rejects.toThrow('is not running');
    const output = await supervisor.output('thread-1', task.id, { block: true, timeoutMs: 2_000 });
    expect(output?.task.status).toBe('stopped');
    await new Promise((resolve) => setTimeout(resolve, 80));
    const pid = Number(await fs.readFile(pidFile, 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it('reports a retrieval timeout without killing the running command', async () => {
    const supervisor = await createSupervisor();
    const task = await supervisor.start(input('sleep 0.2; printf done'));
    const output = await supervisor.output('thread-1', task.id, { block: true, timeoutMs: 5 });
    expect(output).toMatchObject({ retrievalStatus: 'timeout', task: { status: 'running' } });
  });
});

async function createSupervisor() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-background-'));
  directories.push(directory);
  const supervisor = new BackgroundCommandProcessSupervisor(directory);
  supervisors.push(supervisor);
  return supervisor;
}

function input(command: string, workspaceRoot = os.tmpdir()) {
  return {
    scopeId: 'thread-1', command, description: 'Background test', workspaceRoot,
    permissionMode: 'danger-full-access' as const, timeoutMs: 3_000,
  };
}

async function waitForFile(filePath: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { await fs.access(filePath); return; } catch { await new Promise((resolve) => setTimeout(resolve, 5)); }
  }
  throw new Error('Timed out waiting for background process metadata.');
}
