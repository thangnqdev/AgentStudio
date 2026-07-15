import type { SavedAgentPlan } from '../entities/agentPlan.js';

export interface IAgentPlanRepository {
  save(scopeId: string, plan: string): Promise<SavedAgentPlan>;
}
