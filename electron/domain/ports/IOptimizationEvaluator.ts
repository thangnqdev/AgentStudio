import type { OptimizationEvaluation, RuntimeOptimizationConfig } from '../entities/optimizer.js';

export interface IOptimizationEvaluator { evaluate(config: RuntimeOptimizationConfig, baselineRunId: string, candidateRunId: string): Promise<OptimizationEvaluation>; }
