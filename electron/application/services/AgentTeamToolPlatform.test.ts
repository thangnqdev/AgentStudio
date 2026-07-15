import { describe, expect, it, vi } from 'vitest';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { ManageAgentTeams } from '../usecases/ManageAgentTeams.js';
import { AgentTeamToolPlatform } from './AgentTeamToolPlatform.js';

describe('AgentTeamToolPlatform', () => {
  it('exposes exact team tools to a lead and delegates standalone agents', async () => {
    const teams = fixtureTeams();
    const baseExecute = vi.fn(async () => ({ ok: true, output: 'base' }));
    const platform = createPlatform(teams, baseExecute);
    expect((await platform.list('/workspace')).map((tool) => tool.name)).toEqual(['Agent', 'SendMessage', 'TeamCreate', 'TeamDelete']);
    await expect(platform.execute('Agent', {
      description: 'Review auth', prompt: 'Review it', name: 'reviewer', run_in_background: true,
    }, '/workspace', 'workspace-write')).resolves.toEqual({ ok: true, output: 'base' });
    expect(baseExecute).toHaveBeenCalledOnce();
  });

  it('creates a team, launches named team agents asynchronously, and routes team messages', async () => {
    const teams = fixtureTeams();
    const platform = createPlatform(teams, vi.fn());
    const created = await platform.execute('TeamCreate', { team_name: 'reviewers' }, '/workspace', 'workspace-write');
    expect(created.ok).toBe(true);
    const launched = await platform.execute('Agent', {
      description: 'Review auth', prompt: 'Review it', name: 'reviewer', team_name: 'reviewers',
    }, '/workspace', 'workspace-write');
    expect(JSON.parse(launched.output)).toMatchObject({ status: 'async_launched', name: 'reviewer', team_name: 'reviewers' });
    const delivered = await platform.execute('SendMessage', {
      to: 'reviewer', summary: 'Please inspect timeout behavior before completing', message: 'Inspect it.',
    }, '/workspace', 'workspace-write');
    expect(delivered).toEqual({ ok: true, output: 'reviewer: delivered' });
    expect(teams.spawn).toHaveBeenCalledWith(expect.objectContaining({ runInBackground: false }), expect.anything(), expect.anything());
  });

  it('hides lifecycle tools from a teammate and blocks lifecycle execution', async () => {
    const teams = fixtureTeams();
    teams.create.mockRejectedValueOnce(new Error('Only a team lead can create a team.'));
    const platform = createPlatform(teams, vi.fn(), 'worker-1');
    expect((await platform.list('/workspace')).map((tool) => tool.name)).toEqual(['Agent', 'SendMessage']);
    await expect(platform.execute('TeamCreate', { team_name: 'nested' }, '/workspace', 'workspace-write'))
      .resolves.toEqual({ ok: false, output: 'Only a team lead can create a team.' });
  });
});

function fixtureTeams() {
  let active = false;
  return {
    get: vi.fn(async () => active ? { name: 'reviewers' } : null),
    create: vi.fn(async () => {
      active = true;
      return { name: 'reviewers', id: 'team-1', leadAgentId: 'team-lead@reviewers', taskListId: 'team:1' };
    }),
    delete: vi.fn(async () => ({ name: 'reviewers' })),
    spawn: vi.fn(async () => ({ worker: { id: 'worker-1', name: 'reviewer', description: 'Review auth' }, team: { name: 'reviewers' } })),
    send: vi.fn(async () => ['reviewer: delivered']),
  };
}

function createPlatform(teams: ReturnType<typeof fixtureTeams>, execute: ReturnType<typeof vi.fn>, parentAgentId?: string) {
  const base = { list: async () => [
    { name: 'Agent', description: '', risk: 'network' as const, parameters: {} },
    { name: 'SendMessage', description: '', risk: 'network' as const, parameters: {} },
  ] };
  return new AgentTeamToolPlatform(
    base, { execute: execute as IToolExecutor['execute'] }, teams as unknown as ManageAgentTeams,
    { runner: { run: vi.fn() }, events: { emitWorker: vi.fn(), emitEvent: vi.fn() } },
    { scopeId: 'scope-1', ...(parentAgentId ? { parentAgentId } : {}), depth: parentAgentId ? 1 : 0 },
  );
}
