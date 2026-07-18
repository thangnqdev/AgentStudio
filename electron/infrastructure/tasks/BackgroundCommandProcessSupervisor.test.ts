import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { BackgroundCommandProcessHost } from './BackgroundCommandProcessHost.js';
import { BackgroundCommandProcessSupervisor } from './BackgroundCommandProcessSupervisor.js';

const directories: string[] = [];
const supervisors: BackgroundCommandProcessSupervisor[] = [];
const execFileAsync = promisify(execFile);

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

  it('reattaches output and stop authority from a fresh supervisor instance', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-background-recovery-'));
    directories.push(directory);
    const first = createSupervisorFor(directory);
    const task = await first.start(input('printf start; sleep 0.2; printf end'));
    const recovered = createSupervisorFor(directory);
    const completed = await recovered.output('thread-1', task.id, { block: true, timeoutMs: 2_000 });
    expect(completed).toMatchObject({ retrievalStatus: 'success', task: { status: 'completed', exitCode: 0 } });
    expect(completed?.output).toContain('start');
    expect(completed?.output).toContain('end');

    const running = await recovered.start(input('while true; do printf tick; sleep 0.05; done'));
    const third = createSupervisorFor(directory);
    await expect(third.stop('thread-1', running.id)).resolves.toMatchObject({ status: 'stopped' });
  });

  it('continues after the process that launched the sidecar exits', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-background-parent-exit-'));
    directories.push(directory);
    const fixture = fileURLToPath(new URL('./fixtures/startPersistentBackgroundCommand.ts', import.meta.url));
    const loader = fileURLToPath(new URL('../../../node_modules/tsx/dist/loader.mjs', import.meta.url));
    const launched = await execFileAsync(process.execPath, ['--import', loader, fixture, directory], { timeout: 5_000 });
    expect(JSON.parse(launched.stdout)).toEqual({ id: 'bg-parent-exit' });

    const recovered = createSupervisorFor(directory);
    const completed = await recovered.output('thread-1', 'bg-parent-exit', { block: true, timeoutMs: 3_000 });
    expect(completed).toMatchObject({ retrievalStatus: 'success', task: { status: 'completed', exitCode: 0 } });
    expect(completed?.output).toContain('after-parent-exit');
  });

  it('claims each terminal completion once without crossing chat scopes', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-background-notification-'));
    directories.push(directory);
    const supervisor = createSupervisorFor(directory);
    const task = await supervisor.start(input('printf notification-output'));
    await supervisor.output('thread-1', task.id, { block: true, timeoutMs: 2_000 });
    await expect(supervisor.drainCompleted('other-thread')).resolves.toEqual([]);
    const recovered = createSupervisorFor(directory);
    await expect(recovered.drainCompleted('thread-1')).resolves.toEqual([
      expect.objectContaining({ task: expect.objectContaining({ id: task.id, status: 'completed' }), output: 'notification-output' }),
    ]);
    await expect(supervisor.drainCompleted('thread-1')).resolves.toEqual([]);
    await expect(recovered.drainRendererNotices()).resolves.toEqual([
      expect.objectContaining({
        workspaceRoot: task.workspaceRoot,
        notice: expect.objectContaining({ id: task.id, scopeId: 'thread-1', status: 'completed', exitCode: 0 }),
      }),
    ]);
    await expect(supervisor.drainRendererNotices()).resolves.toEqual([]);
  });
});

async function createSupervisor() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-background-'));
  directories.push(directory);
  const supervisor = createSupervisorFor(directory);
  return supervisor;
}

function createSupervisorFor(directory: string) {
  const compiledEntry = process.env.AGENTSTUDIO_COMPILED_BACKGROUND_ENTRY;
  const entry = compiledEntry || fileURLToPath(new URL('../../backgroundCommandProcess.ts', import.meta.url));
  const loader = fileURLToPath(new URL('../../../node_modules/tsx/dist/loader.mjs', import.meta.url));
  const host = new BackgroundCommandProcessHost(entry, compiledEntry ? [] : ['--import', loader]);
  const supervisor = new BackgroundCommandProcessSupervisor(directory, host);
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
