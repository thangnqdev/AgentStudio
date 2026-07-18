import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CronScope, CronTask } from '../../domain/entities/cron.js';
import type { ICronTaskRepository } from '../../domain/ports/ICronTaskRepository.js';
import { CronScheduler } from './CronScheduler.js';
import { PrivateCronTaskRepository } from './PrivateCronTaskRepository.js';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(temporaryDirectories.splice(0).map((item) => fs.rm(item, { recursive: true, force: true })));
});

describe('CronScheduler', () => {
  it('fires a missed one-shot once even across repeated ticks', async () => {
    const fixture = await setup();
    const task = await fixture.repository.create(fixture.scope, {
      cron: '* * * * *', prompt: 'run check', recurring: false, durable: false,
    }, NOW);
    const fire = vi.fn(async () => undefined);
    const scheduler = new CronScheduler(fixture.repository, { fire }, fixture.scope);

    await expect(scheduler.tick(NOW + 120_000)).resolves.toMatchObject([{ id: task.id }]);
    await expect(scheduler.tick(NOW + 120_000)).resolves.toEqual([]);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('does not overlap ticks and bounds too-small timer intervals', async () => {
    vi.useFakeTimers();
    let release: (() => void) | undefined;
    const claimDue = vi.fn(() => new Promise<CronTask[]>((resolve) => { release = () => resolve([]); }));
    const repository = fakeRepository(claimDue);
    const scheduler = new CronScheduler(repository, { fire: vi.fn(async () => undefined) }, SCOPE, { tickIntervalMs: 1 });
    scheduler.start();
    expect(claimDue).toHaveBeenCalledTimes(1);
    await expect(scheduler.tick(NOW)).resolves.toEqual([]);
    expect(claimDue).toHaveBeenCalledTimes(1);
    release?.();
    await vi.advanceTimersByTimeAsync(249);
    expect(claimDue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(claimDue).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('isolates sink failures so remaining claimed tasks still fire', async () => {
    const first = cronTask('11111111');
    const second = cronTask('22222222');
    const repository = fakeRepository(vi.fn(async () => [first, second]));
    const fire = vi.fn(async (_scope: CronScope, task: CronTask) => {
      if (task.id === first.id) throw new Error('sink unavailable');
    });
    const scheduler = new CronScheduler(repository, { fire }, SCOPE);
    await scheduler.tick(NOW);
    expect(fire).toHaveBeenCalledTimes(2);
    expect(repository.releaseClaim).toHaveBeenCalledWith(SCOPE, first);
  });
});

const NOW = new Date(2026, 0, 2, 12, 0, 0).getTime();
const SCOPE: CronScope = { workspaceRoot: '/workspace', scopeId: 'scope', ownerId: 'owner', ownerKind: 'lead' };

function fakeRepository(claimDue: ICronTaskRepository['claimDue']): ICronTaskRepository {
  return {
    create: vi.fn(), list: vi.fn(async () => []), remove: vi.fn(async () => false), claimDue,
    releaseClaim: vi.fn(async () => undefined),
  } as ICronTaskRepository;
}

function cronTask(id: string): CronTask {
  return { id, cron: '* * * * *', prompt: id, createdAt: NOW - 120_000, recurring: false, durable: false };
}

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-cron-scheduler-'));
  temporaryDirectories.push(root);
  const scope = { ...SCOPE, workspaceRoot: path.join(root, 'workspace') };
  await fs.mkdir(scope.workspaceRoot);
  return { scope, repository: new PrivateCronTaskRepository(path.join(root, 'storage')) };
}
