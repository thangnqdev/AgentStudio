import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSeatbeltProfile, spawnAndCollect } from './SandboxedCommandExecutor.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

describe('SandboxedCommandExecutor', () => {
  it('does not allow an unrestricted macOS filesystem read rule', () => {
    const profile = buildSeatbeltProfile('/workspace');
    expect(profile).not.toContain('(allow file-read*)\n');
    expect(profile).toContain('(subpath "/workspace")');
  });

  it('kills a SIGTERM-resistant process after its grace period', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-studio-command-')); directories.push(directory);
    const pidFile = path.join(directory, 'child.pid');
    const script = "require('node:fs').writeFileSync(process.argv[1], String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);";
    const result = await spawnAndCollect(process.execPath, ['-e', script, pidFile], directory, 100, 30);
    expect(result.ok).toBe(false);
    const pid = Number(await fs.readFile(pidFile, 'utf8'));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it('terminates an active process when the agent session is cancelled', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-command-cancel-')); directories.push(directory);
    const pidFile = path.join(directory, 'child.pid');
    const script = "require('node:fs').writeFileSync(process.argv[1], String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);";
    const controller = new AbortController();
    const execution = spawnAndCollect(process.execPath, ['-e', script, pidFile], directory, 10_000, 30, controller.signal);
    await waitForFile(pidFile);
    controller.abort();

    await expect(execution).resolves.toMatchObject({ ok: false, output: expect.stringContaining('cancelled') });
    const pid = Number(await fs.readFile(pidFile, 'utf8'));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(() => process.kill(pid, 0)).toThrow();
  });
});

async function waitForFile(filePath: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { await fs.access(filePath); return; } catch { await new Promise((resolve) => setTimeout(resolve, 5)); }
  }
  throw new Error('Timed out waiting for child process to start.');
}
