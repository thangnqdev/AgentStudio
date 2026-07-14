import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemLifecycleHookSource } from './FileSystemLifecycleHookSource.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('FileSystemLifecycleHookSource', () => {
  it('loads a bounded declarative workspace hook file', async () => {
    const root = await temporaryDirectory();
    await fs.mkdir(path.join(root, '.agentstudio'));
    await fs.writeFile(path.join(root, '.agentstudio', 'hooks.json'), JSON.stringify({
      version: 1,
      hooks: { PreToolUse: [{ id: 'review-shell', matcher: 'run_*', actions: [{ type: 'require_approval', reason: 'Review shell.' }] }] },
    }));
    await expect(new FileSystemLifecycleHookSource().list(root)).resolves.toMatchObject([
      { id: 'review-shell', event: 'PreToolUse', matcher: 'run_*' },
    ]);
  });

  it('treats a missing file as no hooks and rejects invalid content', async () => {
    const root = await temporaryDirectory();
    const source = new FileSystemLifecycleHookSource();
    await expect(source.list(root)).resolves.toEqual([]);
    await fs.mkdir(path.join(root, '.agentstudio'));
    await fs.writeFile(path.join(root, '.agentstudio', 'hooks.json'), '{');
    await expect(source.list(root)).rejects.toThrow('Invalid lifecycle hooks');
  });

  it.runIf(process.platform !== 'win32')('rejects symbolic links', async () => {
    const root = await temporaryDirectory();
    const outside = path.join(root, 'outside.json');
    await fs.writeFile(outside, JSON.stringify({ version: 1, hooks: {} }));
    await fs.mkdir(path.join(root, '.agentstudio'));
    await fs.symlink(outside, path.join(root, '.agentstudio', 'hooks.json'));
    await expect(new FileSystemLifecycleHookSource().list(root)).rejects.toThrow('Symbolic links are not allowed');
  });
});

async function temporaryDirectory() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-hooks-'));
  temporaryDirectories.push(dir);
  return dir;
}
