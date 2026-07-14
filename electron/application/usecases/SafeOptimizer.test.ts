import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIMIZATION_CONFIG, OPTIMIZER_EVALUATION_VERSION, OPTIMIZER_STATE_VERSION, configurationDigest, type OptimizerState, type RuntimeOptimizationConfig } from '../../domain/entities/optimizer.js';
import type { IOptimizationEvaluator } from '../../domain/ports/IOptimizationEvaluator.js';
import type { IOptimizerRepository } from '../../domain/ports/IOptimizerRepository.js';
import { SafeOptimizer } from './SafeOptimizer.js';

describe('SafeOptimizer', () => {
  it('evaluates, promotes only improvement, and rolls back exact snapshots', async () => {
    const repository = new MemoryRepository(); const optimizer = create(repository, evaluator(0.8, 0.82));
    const candidate = await optimizer.createCandidate({ retrievalTopK: 7 });
    const evaluated = await optimizer.evaluateCandidate(candidate.id, 'baseline', 'candidate');
    expect(evaluated.status).toBe('evaluated');
    const promoted = await optimizer.promote(candidate.id);
    expect(promoted.active.retrievalTopK).toBe(7); expect(promoted.revision).toBe(2);
    const rolledBack = await optimizer.rollback();
    expect(rolledBack.active).toEqual(DEFAULT_OPTIMIZATION_CONFIG); expect(rolledBack.revision).toBe(3);
  });

  it('rejects ties, stale revisions, unknown models and security fields', async () => {
    const repository = new MemoryRepository(); const tied = create(repository, evaluator(0.9, 0.9));
    const rejected = await tied.createCandidate({ timeoutMs: 10_000 });
    expect((await tied.evaluateCandidate(rejected.id, 'a', 'b')).status).toBe('rejected');
    await expect(tied.promote(rejected.id)).rejects.toThrow('not exceeded');
    await expect(tied.createCandidate({ modelChoice: 'unknown' })).rejects.toThrow('allow-list');
    await expect(tied.createCandidate({ permissionMode: 'danger-full-access' } as never)).rejects.toThrow('non-allow-listed');
  });

  it('uses optimistic revisions and does not expose candidate state to evaluator mutation', async () => {
    const repository = new MemoryRepository(); const optimizer = create(repository, evaluator(0.8, 0.9));
    const first = await optimizer.createCandidate({ retrievalTopK: 6 }); const stale = await optimizer.createCandidate({ retrievalTopK: 7 });
    await optimizer.evaluateCandidate(first.id, 'base-a', 'next-a'); await optimizer.evaluateCandidate(stale.id, 'base-b', 'next-b');
    await optimizer.promote(first.id); await expect(optimizer.promote(stale.id)).rejects.toThrow('stale');
    const mutating = create(repository, { evaluate: async (baselineConfig, candidateConfig, baselineRunId, candidateRunId) => {
      candidateConfig.timeoutMs = 1_000;
      return evaluator(0.8, 0.9).evaluate(baselineConfig, candidateConfig, baselineRunId, candidateRunId);
    } });
    const protectedCandidate = await mutating.createCandidate({ timeoutMs: 20_000 });
    await expect(mutating.evaluateCandidate(protectedCandidate.id, 'base-c', 'next-c')).rejects.toThrow('decision');
    expect((await mutating.getState()).candidates.find((item) => item.id === protectedCandidate.id)?.config.timeoutMs).toBe(20_000);
  });
});

class MemoryRepository implements IOptimizerRepository {
  state: OptimizerState = { version: OPTIMIZER_STATE_VERSION, revision: 1, active: structuredClone(DEFAULT_OPTIMIZATION_CONFIG), candidates: [], history: [] };
  async load() { return structuredClone(this.state); }
  async save(state: OptimizerState) { this.state = structuredClone(state); }
}
function evaluator(baselineScore: number, candidateScore: number): IOptimizationEvaluator { return { evaluate: async (_baselineConfig: RuntimeOptimizationConfig, candidateConfig: RuntimeOptimizationConfig, baselineRunId: string, candidateRunId: string) => ({ version: OPTIMIZER_EVALUATION_VERSION, evaluatorId: 'fake', evaluatorVersion: '1.0.0', baselineRunId, candidateRunId, baselineScore, candidateScore, improvement: candidateScore - baselineScore, minimumImprovement: 0.001, passed: candidateScore - baselineScore >= 0.001, configurationDigest: configurationDigest(candidateConfig), evaluatedAt: new Date().toISOString() }) }; }
function create(repository: IOptimizerRepository, optimizationEvaluator: IOptimizationEvaluator) { return new SafeOptimizer(repository, optimizationEvaluator, { listAllowedModelIds: async () => ['allowed'] }); }
