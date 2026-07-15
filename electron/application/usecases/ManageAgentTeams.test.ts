import { describe, expect, it, vi } from 'vitest';
import type { AgentTeamRecord } from '../../domain/entities/agentTeam.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import type { AgentWorkerExecution, ManageAgentWorkers } from './ManageAgentWorkers.js';
import type { ManageAgentWorkItems } from './ManageAgentWorkItems.js';
import { ManageAgentTeams, type AgentTeamContext } from './ManageAgentTeams.js';

describe('ManageAgentTeams', () => {
  it('creates one team, allocates unique teammate names, and shares one task list', async () => {
    const fixture = createFixture();
    const team = await fixture.manager.create({ teamName: 'reviewers', description: 'Review auth' }, fixture.context);
    const first = await fixture.manager.spawn(spawn('tester'), fixture.context, fixture.execution);
    const second = await fixture.manager.spawn(spawn('tester'), fixture.context, fixture.execution);

    expect(team).toMatchObject({ name: 'reviewers', leadAgentId: 'team-lead@reviewers' });
    expect(first.worker.name).toBe('tester');
    expect(second.worker.name).toBe('tester-2');
    expect(await fixture.manager.taskListId('scope-1')).toBe(team.taskListId);
    await expect(fixture.manager.create({ teamName: 'another' }, fixture.context)).rejects.toThrow('one active team');
    expect(fixture.events).toHaveBeenCalled();
  });

  it('persists mailbox delivery and a correlated graceful shutdown handshake', async () => {
    const fixture = createFixture();
    await fixture.manager.create({ teamName: 'reviewers' }, fixture.context);
    const spawned = await fixture.manager.spawn(spawn('tester'), fixture.context, fixture.execution);
    await fixture.manager.send({
      to: 'tester', summary: 'Please review timeout handling before finishing', message: 'Review timeouts.',
    }, fixture.context, fixture.execution);
    await fixture.manager.send({
      to: 'tester', message: { type: 'shutdown_request', reason: 'Review is complete.' },
    }, fixture.context, fixture.execution);
    const request = (await fixture.repository.getByScope('scope-1'))!.shutdownRequests[0];

    await fixture.manager.send({
      to: 'team-lead', message: { type: 'shutdown_response', request_id: request.id, approve: true },
    }, { ...fixture.context, parentAgentId: spawned.worker.id, depth: 1 }, fixture.execution);

    const saved = (await fixture.repository.getByScope('scope-1'))!;
    expect(saved.mailbox.map((message) => message.kind)).toEqual(['message', 'shutdown_request', 'shutdown_response']);
    expect(saved.shutdownRequests[0]).toMatchObject({ status: 'approved', to: 'tester' });
    expect(fixture.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: 'parent', message: expect.objectContaining({ request_id: request.id }) }),
      expect.objectContaining({ parentAgentId: spawned.worker.id }), fixture.execution,
    );
    const view = await fixture.manager.view('scope-1');
    expect(view).not.toHaveProperty('mailbox');
    expect(view).not.toHaveProperty('shutdownRequests');
    expect(view?.recentMessages.at(-1)).not.toHaveProperty('content');
  });

  it('delivers owner changes as task-assignment mailbox messages', async () => {
    const fixture = createFixture();
    await fixture.manager.create({ teamName: 'reviewers' }, fixture.context);
    await fixture.manager.spawn(spawn('tester'), fixture.context, fixture.execution);
    await fixture.manager.assignTask('scope-1', {
      id: '7', subject: 'Verify auth', description: 'Run auth checks', owner: 'tester', status: 'pending',
      blocks: [], blockedBy: [], createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z',
    }, fixture.context, fixture.execution);
    expect((await fixture.repository.getByScope('scope-1'))?.mailbox.at(-1)).toMatchObject({
      kind: 'task_assignment', from: 'team-lead', to: 'tester',
    });
  });

  it('refuses deletion while a teammate runs, then clears the shared task list', async () => {
    const fixture = createFixture();
    const team = await fixture.manager.create({ teamName: 'reviewers' }, fixture.context);
    await fixture.manager.spawn(spawn('tester'), fixture.context, fixture.execution);
    fixture.statuses.set('worker-1', 'running');
    await expect(fixture.manager.delete(fixture.context)).rejects.toThrow('teammates are active');
    fixture.statuses.set('worker-1', 'completed');
    await fixture.manager.delete(fixture.context);
    expect(fixture.clear).toHaveBeenCalledWith(team.taskListId);
    expect(await fixture.repository.getByScope('scope-1')).toBeNull();
  });

  it('suffixes names retained by preserved worker transcripts after team deletion', async () => {
    const fixture = createFixture();
    await fixture.manager.create({ teamName: 'reviewers' }, fixture.context);
    await fixture.manager.spawn(spawn('tester'), fixture.context, fixture.execution);
    fixture.statuses.set('worker-1', 'completed');
    await fixture.manager.delete(fixture.context);
    await fixture.manager.create({ teamName: 'reviewers' }, fixture.context);
    const launched = await fixture.manager.spawn(spawn('tester'), fixture.context, fixture.execution);
    expect(launched.worker.name).toBe('tester-2');
  });
});

function createFixture() {
  const repository = new MemoryTeamRepository();
  const statuses = new Map<string, string>();
  const names = new Map<string, string>();
  let nextWorker = 1;
  const spawnWorker = vi.fn(async (request: ReturnType<typeof spawn>) => {
    const id = `worker-${nextWorker++}`;
    statuses.set(id, 'completed');
    names.set(id, request.name);
    return { background: true as const, worker: {
      id, name: request.name, description: request.description, permissionMode: 'workspace-write' as const,
    } };
  });
  const send = vi.fn(async (request: { to: string }) => [`${request.to}: delivered`]);
  const workers = {
    spawn: spawnWorker, send,
    list: async () => [...statuses].map(([id, status]) => ({ id, status, name: names.get(id), completedSteps: 1 })),
  } as unknown as ManageAgentWorkers;
  const clear = vi.fn(async () => undefined);
  const events = vi.fn();
  const manager = new ManageAgentTeams(
    repository, workers, { clear } as unknown as ManageAgentWorkItems, { emitTeam: events },
    () => '2026-07-15T00:00:00.000Z',
  );
  const context: AgentTeamContext = {
    scopeId: 'scope-1', workspaceRoot: '/workspace', permissionMode: 'workspace-write', depth: 0,
  };
  const execution = { runner: { run: vi.fn() }, events: { emitWorker: vi.fn(), emitEvent: vi.fn() } } as AgentWorkerExecution;
  return { repository, statuses, send, clear, events, manager, context, execution };
}

function spawn(name: string) {
  return { name, description: 'Review code', prompt: 'Review auth', runInBackground: false };
}

class MemoryTeamRepository implements IAgentTeamRepository {
  private readonly teams = new Map<string, AgentTeamRecord>();
  async create(team: AgentTeamRecord) { this.teams.set(team.scopeId, structuredClone(team)); }
  async getByScope(scopeId: string) { return structuredClone(this.teams.get(scopeId) ?? null); }
  async list() { return structuredClone([...this.teams.values()]); }
  async save(team: AgentTeamRecord) { this.teams.set(team.scopeId, structuredClone(team)); }
  async delete(scopeId: string) { this.teams.delete(scopeId); }
}
