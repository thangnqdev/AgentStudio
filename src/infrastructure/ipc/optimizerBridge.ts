import type { RuntimeOptimizationConfig } from '../../domain/entities/optimizer';

function bridge() { if (!window.agentStudio) throw new Error('Electron bridge is not available.'); return window.agentStudio; }
export const OptimizerBridge = {
  state: () => bridge().getOptimizerState(),
  create: (changes: Partial<RuntimeOptimizationConfig>) => bridge().createOptimizationCandidate(changes),
  evaluate: (payload: { candidateId: string; baselineRunId: string; candidateRunId: string }) => bridge().evaluateOptimizationCandidate(payload),
  promote: (candidateId: string) => bridge().promoteOptimizationCandidate(candidateId),
  rollback: () => bridge().rollbackOptimization(),
};
