import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_CRON_JOBS, type CronScope } from '../../domain/entities/cron.js';
import { PrivateCronTaskRepository } from './PrivateCronTaskRepository.js';

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((item) => fs.rm(item, { recursive: true, force: true }))));

describe('PrivateCronTaskRepository', () => {
  it('isolates session and durable jobs per workspace/scope/owner and writes only durable jobs privately', async () => {
    const fixture = await setup();
    const session = await fixture.repository.create(fixture.scope, input(false), NOW);
    const durable = await fixture.repository.create(fixture.scope, input(true), NOW);
    expect(await fixture.repository.list(fixture.scope)).toMatchObject([
      { id: durable.id, durable: true }, { id: session.id, durable: false },
    ]);
    expect(await fixture.repository.list({ ...fixture.scope, ownerId: 'another-owner' })).toEqual([]);

    const files = await fs.readdir(fixture.storage);
    expect(files).toHaveLength(1);
    const target = path.join(fixture.storage, files[0]!);
    expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
    const envelope = JSON.parse(await fs.readFile(target, 'utf8')) as { tasks: Array<{ id: string }> };
    expect(envelope.tasks.map((task) => task.id)).toEqual([durable.id]);
  });

  it('serializes concurrent claims so a missed one-shot fires once and is deleted', async () => {
    const fixture = await setup();
    const created = await fixture.repository.create(fixture.scope, { ...input(true), recurring: false }, NOW);
    const claims = await Promise.all([
      fixture.repository.claimDue(fixture.scope, NOW + 120_000),
      fixture.repository.claimDue(fixture.scope, NOW + 120_000),
    ]);
    expect(claims.flat().map((task) => task.id)).toEqual([created.id]);
    expect(await fixture.repository.list(fixture.scope)).toEqual([]);
  });

  it('persists lastFiredAt and makes concurrent deletion idempotent', async () => {
    const fixture = await setup();
    const recurring = await fixture.repository.create(fixture.scope, input(true), NOW);
    const firedAt = NOW + 120_000;
    expect(await fixture.repository.claimDue(fixture.scope, firedAt)).toMatchObject([{ id: recurring.id }]);
    const reloaded = new PrivateCronTaskRepository(fixture.storage);
    expect(await reloaded.list(fixture.scope)).toMatchObject([{ id: recurring.id, lastFiredAt: firedAt }]);
    const removed = await Promise.all([
      fixture.repository.remove(fixture.scope, recurring.id),
      reloaded.remove(fixture.scope, recurring.id),
    ]);
    expect(removed.sort()).toEqual([false, true]);
  });

  it('restores a claimed task when delivery fails without duplicating it', async () => {
    const fixture = await setup();
    const created = await fixture.repository.create(fixture.scope, { ...input(true), recurring: false }, NOW);
    const [claimed] = await fixture.repository.claimDue(fixture.scope, NOW + 120_000);
    await fixture.repository.releaseClaim(fixture.scope, claimed!);
    await fixture.repository.releaseClaim(fixture.scope, claimed!);
    expect(await fixture.repository.list(fixture.scope)).toMatchObject([{ id: created.id }]);
    expect(await fixture.repository.claimDue(fixture.scope, NOW + 120_000)).toMatchObject([{ id: created.id }]);
  });

  it('enforces the 50-job limit inside the mutation queue and rejects durable teammate jobs', async () => {
    const fixture = await setup();
    await Promise.all(Array.from({ length: MAX_CRON_JOBS }, () => fixture.repository.create(fixture.scope, input(false), NOW)));
    await expect(fixture.repository.create(fixture.scope, input(false), NOW)).rejects.toThrow(`max ${MAX_CRON_JOBS}`);
    await expect(fixture.repository.create({ ...fixture.scope, ownerId: 'worker', ownerKind: 'teammate' }, input(true), NOW))
      .rejects.toThrow('not supported for teammates');
  });
});

const NOW = new Date(2026, 0, 2, 12, 0, 0).getTime();

function input(durable: boolean) {
  return { cron: '* * * * *', prompt: 'check status', recurring: true, durable };
}

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-cron-'));
  temporaryDirectories.push(root);
  const workspaceRoot = path.join(root, 'workspace');
  const storage = path.join(root, 'private-cron');
  await fs.mkdir(workspaceRoot);
  const scope: CronScope = { workspaceRoot, scopeId: 'task-1', ownerId: 'lead-1', ownerKind: 'lead' };
  return { storage, scope, repository: new PrivateCronTaskRepository(storage) };
}
