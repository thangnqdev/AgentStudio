import type { OptimizationEvaluation, RuntimeOptimizationConfig } from '../entities/optimizer.js';

export interface IOptimizationEvaluator {
  evaluate(
    baselineConfig: RuntimeOptimizationConfig,
    candidateConfig: RuntimeOptimizationConfig,
    baselineRunId: string,
    candidateRunId: string,
  ): Promise<OptimizationEvaluation>;
}
