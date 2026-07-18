import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { acquirePrivateCronScopeLock } from './PrivateCronScopeLock.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((item) => fs.rm(item, { recursive: true, force: true }))));

describe('acquirePrivateCronScopeLock', () => {
  it('serializes owners and removes only the matching lock token', async () => {
    const target = await createTarget();
    const releaseFirst = await acquirePrivateCronScopeLock(target);
    let acquired = false;
    const second = acquirePrivateCronScopeLock(target).then((release) => { acquired = true; return release; });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(acquired).toBe(false);
    await releaseFirst();
    const releaseSecond = await second;
    expect(acquired).toBe(true);
    await releaseSecond();
    await expect(fs.access(target)).rejects.toThrow();
  });

  it('replaces a symlink lock without touching its target', async () => {
    const target = await createTarget();
    const outside = `${target}.outside`;
    await fs.writeFile(outside, 'keep');
    await fs.symlink(outside, target);
    const release = await acquirePrivateCronScopeLock(target);
    expect(await fs.readFile(outside, 'utf8')).toBe('keep');
    await release();
  });
});

async function createTarget() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-cron-lock-'));
  directories.push(root);
  return path.join(root, 'scope.lock');
}
