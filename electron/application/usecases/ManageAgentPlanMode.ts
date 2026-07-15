import type { AgentPlanSessionSnapshot } from '../../domain/entities/agentPlan.js';
import type { IAgentPlanRepository } from '../../domain/ports/IAgentPlanRepository.js';

const MAX_RETAINED_PLAN_SESSIONS = 200;

export class ManageAgentPlanMode {
  private readonly repository: IAgentPlanRepository;
  private readonly sessions = new Map<string, AgentPlanSessionSnapshot>();

  constructor(repository: IAgentPlanRepository) {
    this.repository = repository;
  }

  get(scopeId: string): AgentPlanSessionSnapshot {
    return { ...(this.sessions.get(scopeId) ?? defaultSnapshot(scopeId)) };
  }

  isActive(scopeId: string) {
    return this.sessions.get(scopeId)?.mode === 'plan';
  }

  enter(scopeId: string) {
    const current = this.get(scopeId);
    const next: AgentPlanSessionSnapshot = { ...current, mode: 'plan', updatedAt: new Date().toISOString() };
    this.sessions.set(scopeId, next);
    this.prune();
    return { ...next };
  }

  async approve(scopeId: string, plan: string) {
    if (!this.isActive(scopeId)) throw new Error('ExitPlanMode can only be used while plan mode is active.');
    const saved = await this.repository.save(scopeId, plan);
    const next: AgentPlanSessionSnapshot = {
      scopeId,
      mode: 'default',
      approvedPlan: plan,
      planReference: saved.reference,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(scopeId, next);
    return { ...next };
  }

  private prune() {
    if (this.sessions.size <= MAX_RETAINED_PLAN_SESSIONS) return;
    const inactive = [...this.sessions.values()]
      .filter((session) => session.mode === 'default')
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
    while (this.sessions.size > MAX_RETAINED_PLAN_SESSIONS && inactive.length) {
      const session = inactive.shift();
      if (session) this.sessions.delete(session.scopeId);
    }
  }
}

function defaultSnapshot(scopeId: string): AgentPlanSessionSnapshot {
  return { scopeId, mode: 'default', updatedAt: new Date(0).toISOString() };
}
