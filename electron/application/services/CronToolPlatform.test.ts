import { describe, expect, it, vi } from 'vitest';
import type { CronScope, CronTask } from '../../domain/entities/cron.js';
import type { ICronTaskRepository } from '../../domain/ports/ICronTaskRepository.js';
import { CronToolPlatform } from './CronToolPlatform.js';

const NOW = new Date(2026, 0, 2, 8, 0, 0).getTime();

describe('CronToolPlatform', () => {
  it('exposes exact deferred tools and returns exact JSON summaries', async () => {
    const fixture = setup('lead');
    const tools = await fixture.platform.list('/workspace');
    expect(tools.map((tool) => tool.name)).toEqual(['base', 'CronCreate', 'CronDelete', 'CronList']);
    const created = await fixture.platform.execute('CronCreate', { cron: '0 9 * * *', prompt: 'check' }, '/workspace', 'workspace-write');
    expect(JSON.parse(created.output)).toMatchObject({ id: '1234abcd', recurring: true, durable: false });
    expect(fixture.observeScope).toHaveBeenCalledWith({ workspaceRoot: '/workspace', scopeId: 'scope', ownerId: 'owner', ownerKind: 'lead' });
  });

  it('rejects durable teammate schedules before persistence', async () => {
    const fixture = setup('teammate');
    const result = await fixture.platform.execute('CronCreate', { cron: '* * * * *', prompt: 'check', durable: true }, '/workspace', 'workspace-write');
    expect(result).toEqual({ ok: false, output: expect.stringContaining('not supported for teammates') });
    expect(fixture.repository.create).not.toHaveBeenCalled();
  });
});

function setup(ownerKind: CronScope['ownerKind']) {
  const task: CronTask = { id: '1234abcd', cron: '0 9 * * *', prompt: 'check', createdAt: NOW, recurring: true, durable: false };
  const repository = {
    create: vi.fn(async () => task), list: vi.fn(async () => [task]),
    remove: vi.fn(async () => true), claimDue: vi.fn(async () => []), releaseClaim: vi.fn(async () => undefined),
  } satisfies ICronTaskRepository;
  const base = { list: vi.fn(async () => [{ name: 'base', description: 'base', risk: 'read' as const, parameters: {} }]), execute: vi.fn() };
  const observeScope = vi.fn();
  return {
    repository, observeScope,
    platform: new CronToolPlatform(base, base, repository, { scopeId: 'scope', ownerId: 'owner', ownerKind }, () => NOW, observeScope),
  };
}
