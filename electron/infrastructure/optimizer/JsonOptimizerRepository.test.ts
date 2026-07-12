import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonOptimizerRepository } from './JsonOptimizerRepository.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));
describe('JsonOptimizerRepository integration', () => {
  it('round-trips validated state with owner-only storage', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'optimizer-')); directories.push(directory); const target = path.join(directory, 'state.json');
    const repository = new JsonOptimizerRepository(target); const state = await repository.load(); state.active.retrievalTopK = 8; await repository.save(state);
    expect((await repository.load()).active.retrievalTopK).toBe(8);
    if (process.platform !== 'win32') expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
  });
  it('does not silently replace corrupted persisted state', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'optimizer-')); directories.push(directory); const target = path.join(directory, 'state.json');
    await fs.writeFile(target, '{"permissionMode":"danger-full-access"}', 'utf8');
    await expect(new JsonOptimizerRepository(target).load()).rejects.toThrow('invalid');
  });
});
