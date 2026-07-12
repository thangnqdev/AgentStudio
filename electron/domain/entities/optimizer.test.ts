import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIMIZATION_CONFIG, OPTIMIZER_EVALUATION_VERSION, assertOptimizationConfig, assertOptimizationEvaluation, configurationDigest, type OptimizationEvaluation } from './optimizer.js';

describe('optimizer invariants', () => {
  it('accepts only bounded, normalized reversible configuration', () => {
    expect(() => assertOptimizationConfig(DEFAULT_OPTIMIZATION_CONFIG)).not.toThrow();
    expect(() => assertOptimizationConfig({ ...DEFAULT_OPTIMIZATION_CONFIG, lexicalWeight: 0.8 })).toThrow('sum to one');
    expect(() => assertOptimizationConfig({ ...DEFAULT_OPTIMIZATION_CONFIG, timeoutMs: 30_001 })).toThrow('timeoutMs');
    expect(() => assertOptimizationConfig({ ...DEFAULT_OPTIMIZATION_CONFIG, permissionMode: 'danger-full-access' } as typeof DEFAULT_OPTIMIZATION_CONFIG)).toThrow('non-allow-listed');
  });

  it('requires truthful improvement and matching configuration provenance', () => {
    const evaluation: OptimizationEvaluation = { version: OPTIMIZER_EVALUATION_VERSION, evaluatorId: 'test', evaluatorVersion: '1.0.0', baselineRunId: 'base', candidateRunId: 'next', baselineScore: 0.8, candidateScore: 0.9, improvement: 0.1, minimumImprovement: 0.01, passed: true, configurationDigest: configurationDigest(DEFAULT_OPTIMIZATION_CONFIG), evaluatedAt: '2026-01-01T00:00:00.000Z' };
    expect(() => assertOptimizationEvaluation(evaluation, DEFAULT_OPTIMIZATION_CONFIG)).not.toThrow();
    expect(() => assertOptimizationEvaluation({ ...evaluation, passed: false }, DEFAULT_OPTIMIZATION_CONFIG)).toThrow('decision');
    expect(() => assertOptimizationEvaluation({ ...evaluation, configurationDigest: 'wrong' }, DEFAULT_OPTIMIZATION_CONFIG)).toThrow('decision');
  });
});
