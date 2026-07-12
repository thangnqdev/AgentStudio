import { assertOptimizationConfig, assertOptimizerState, type OptimizationCandidate, type OptimizerState, type RuntimeOptimizationConfig } from '../../domain/entities/optimizer.js';
import type { IOptimizationEvaluator } from '../../domain/ports/IOptimizationEvaluator.js';
import type { IOptimizerRepository } from '../../domain/ports/IOptimizerRepository.js';
import type { IOptimizationModelCatalog } from '../../domain/ports/IOptimizationModelCatalog.js';

const MAX_CANDIDATES = 100;
const MAX_HISTORY = 20;

export class SafeOptimizer {
  private readonly repository: IOptimizerRepository;
  private readonly evaluator: IOptimizationEvaluator;
  private readonly models: IOptimizationModelCatalog;
  private queue = Promise.resolve();

  constructor(repository: IOptimizerRepository, evaluator: IOptimizationEvaluator, models: IOptimizationModelCatalog) { this.repository = repository; this.evaluator = evaluator; this.models = models; }

  async getState() { const state = await this.repository.load(); assertOptimizerState(state); return structuredClone(state); }

  createCandidate(changes: Partial<RuntimeOptimizationConfig>) {
    return this.exclusive(async () => {
      assertAllowedChanges(changes);
      const state = await this.repository.load();
      const config = { ...state.active, ...changes };
      assertOptimizationConfig(config, await this.models.listAllowedModelIds());
      const changedKeys = (Object.keys(changes) as Array<keyof RuntimeOptimizationConfig>).filter((key) => config[key] !== state.active[key]);
      if (!changedKeys.length) throw new Error('Candidate must change at least one optimizer parameter.');
      const candidate: OptimizationCandidate = { id: crypto.randomUUID(), baseRevision: state.revision, config, changedKeys, status: 'draft', createdAt: new Date().toISOString() };
      state.candidates = [candidate, ...state.candidates].slice(0, MAX_CANDIDATES);
      await this.save(state);
      return structuredClone(candidate);
    });
  }

  evaluateCandidate(candidateId: string, baselineRunId: string, candidateRunId: string) {
    return this.exclusive(async () => {
      const state = await this.repository.load(); const candidate = findCandidate(state, candidateId);
      if (candidate.status === 'promoted') throw new Error('Promoted candidate cannot be evaluated again.');
      const evaluation = await this.evaluator.evaluate(structuredClone(candidate.config), baselineRunId, candidateRunId);
      candidate.evaluation = evaluation;
      candidate.status = evaluation.passed ? 'evaluated' : 'rejected';
      await this.save(state);
      return structuredClone(candidate);
    });
  }

  promote(candidateId: string) {
    return this.exclusive(async () => {
      const state = await this.repository.load(); const candidate = findCandidate(state, candidateId);
      if (candidate.status !== 'evaluated' || !candidate.evaluation?.passed) throw new Error('Candidate has not exceeded its evaluated baseline.');
      if (candidate.baseRevision !== state.revision) throw new Error('Candidate base revision is stale; create and evaluate a new candidate.');
      state.history.unshift({ revision: state.revision, config: structuredClone(state.active), reason: 'promotion', candidateId, activatedAt: new Date().toISOString() });
      state.history = state.history.slice(0, MAX_HISTORY); state.active = structuredClone(candidate.config); state.revision += 1; candidate.status = 'promoted';
      await this.save(state); return structuredClone(state);
    });
  }

  rollback() {
    return this.exclusive(async () => {
      const state = await this.repository.load(); const previous = state.history[0];
      if (!previous) throw new Error('No optimizer configuration is available for rollback.');
      const current = structuredClone(state.active); state.active = structuredClone(previous.config); state.revision += 1;
      state.history = [{ revision: state.revision - 1, config: current, reason: 'rollback' as const, activatedAt: new Date().toISOString() }, ...state.history.slice(1)].slice(0, MAX_HISTORY);
      await this.save(state); return structuredClone(state);
    });
  }

  private async save(state: OptimizerState) { assertOptimizerState(state); await this.repository.save(state); }
  private exclusive<T>(operation: () => Promise<T>): Promise<T> { const next = this.queue.then(operation); this.queue = next.then(() => undefined, () => undefined); return next; }
}

function findCandidate(state: OptimizerState, id: string) { const candidate = state.candidates.find((item) => item.id === id); if (!candidate) throw new Error('Optimization candidate does not exist.'); return candidate; }
function assertAllowedChanges(changes: Partial<RuntimeOptimizationConfig>) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Optimizer changes must be an object.');
  const allowed = new Set<keyof RuntimeOptimizationConfig>(['retrievalTopK', 'lexicalWeight', 'semanticWeight', 'modelChoice', 'contextBudgetTokens', 'retryCount', 'timeoutMs', 'skillRankingWeight']);
  if (Object.keys(changes).some((key) => !allowed.has(key as keyof RuntimeOptimizationConfig))) throw new Error('Optimizer changes contain non-allow-listed parameters.');
}
