import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JsonAgentWorkItemRepository } from './JsonAgentWorkItemRepository.js';

let directory = '';

beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-work-items-')); });
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

describe('JsonAgentWorkItemRepository', () => {
  it('persists a private board under a hashed session identity', async () => {
    const repository = new JsonAgentWorkItemRepository({ directory });
    const board = await repository.load('../../session-secret');
    board.nextId = 2;
    board.items.push({
      id: '1', subject: 'Test', description: '', status: 'pending', blocks: [], blockedBy: [],
      createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z',
    });
    await repository.save('../../session-secret', board);

    const files = await fs.readdir(directory);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[a-f0-9]{64}\.json$/);
    expect(files[0]).not.toContain('session-secret');
    expect(await new JsonAgentWorkItemRepository({ directory }).load('../../session-secret')).toEqual(board);
    expect((await fs.stat(path.join(directory, files[0]))).mode & 0o777).toBe(0o600);
    await repository.delete('../../session-secret');
    expect(await repository.load('../../session-secret')).toEqual({ version: 1, nextId: 1, items: [] });
  });

  it('rejects invalid JSON and oversized task-list identities', async () => {
    const repository = new JsonAgentWorkItemRepository({ directory });
    await expect(repository.load('x'.repeat(257))).rejects.toThrow('Task list ID is invalid');
    await repository.save('corrupt', { version: 1, nextId: 1, items: [] });
    const [target] = await fs.readdir(directory);
    await fs.writeFile(path.join(directory, target), '{broken');
    await expect(repository.load('corrupt')).rejects.toThrow('invalid JSON');
  });
});
