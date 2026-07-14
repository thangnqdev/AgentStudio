import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPrivateLine, writePrivateFileAtomic } from './privateFile.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

describe('privateFile storage', () => {
  it('writes atomically with owner-only permissions', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-studio-private-')); directories.push(directory);
    const target = path.join(directory, 'state.json');
    await writePrivateFileAtomic(target, '{"version":1}');
    await appendPrivateLine(target, '\nnext');
    expect(await fs.readFile(target, 'utf8')).toBe('{"version":1}\nnext');
    if (process.platform !== 'win32') expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
  });
});
