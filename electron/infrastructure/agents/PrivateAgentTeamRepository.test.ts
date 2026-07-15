import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentTeamRecord } from '../../domain/entities/agentTeam.js';
import { PrivateAgentTeamRepository } from './PrivateAgentTeamRepository.js';

let directory = '';
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-teams-')); });
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

describe('PrivateAgentTeamRepository', () => {
  it('persists one private hashed team per scope', async () => {
    const repository = new PrivateAgentTeamRepository(directory);
    await repository.create(team());
    expect(await repository.getByScope('scope-1')).toMatchObject({ name: 'review-team', taskListId: 'team:team-1' });
    const files = await fs.readdir(directory);
    expect(files).toEqual([expect.stringMatching(/^[a-f0-9]{64}\.json$/)]);
    expect(files[0]).not.toContain('scope-1');
    expect((await fs.stat(path.join(directory, files[0]))).mode & 0o777).toBe(0o600);
    await expect(repository.create(team())).rejects.toThrow('already exists');
  });

  it('updates and deletes a team without accepting a symlink store', async () => {
    const repository = new PrivateAgentTeamRepository(directory);
    const record = team();
    await repository.create(record);
    await repository.save({ ...record, description: 'Updated' });
    expect((await repository.list())[0]?.description).toBe('Updated');
    await repository.delete(record.scopeId);
    expect(await repository.getByScope(record.scopeId)).toBeNull();

    await fs.rm(directory, { recursive: true, force: true });
    await fs.symlink(os.tmpdir(), directory);
    await expect(repository.list()).rejects.toThrow('unsafe');
  });
});

function team(): AgentTeamRecord {
  return {
    version: 1, id: 'team-1', scopeId: 'scope-1', name: 'review-team', taskListId: 'team:team-1',
    createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z',
    leadAgentId: 'team-lead@review-team', leadAgentType: 'team-lead', members: [{
      agentId: 'team-lead@review-team', name: 'team-lead', agentType: 'team-lead', permissionMode: 'workspace-write',
      joinedAt: '2026-07-15T00:00:00.000Z',
    }], mailbox: [], shutdownRequests: [],
  };
}
