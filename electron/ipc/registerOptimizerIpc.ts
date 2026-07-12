import { ipcMain } from 'electron';
import { safeOptimizer } from '../optimizerRuntime.js';
import type { RuntimeOptimizationConfig } from '../domain/entities/optimizer.js';

function respond<T>(task: () => Promise<T>) { return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({ success: false as const, error: error instanceof Error ? error.message : 'Optimizer operation failed.' })); }

export function registerOptimizerIpc() {
  ipcMain.handle('optimizer:get-state', () => respond(() => safeOptimizer.getState()));
  ipcMain.handle('optimizer:create-candidate', (_event, rawChanges: unknown) => respond(() => safeOptimizer.createCandidate(readChanges(rawChanges))));
  ipcMain.handle('optimizer:evaluate-candidate', (_event, rawPayload: unknown) => respond(() => {
    const payload = object(rawPayload); return safeOptimizer.evaluateCandidate(id(payload.candidateId, 'candidateId'), id(payload.baselineRunId, 'baselineRunId'), id(payload.candidateRunId, 'candidateRunId'));
  }));
  ipcMain.handle('optimizer:promote', (_event, rawCandidateId: unknown) => respond(() => safeOptimizer.promote(id(rawCandidateId, 'candidateId'))));
  ipcMain.handle('optimizer:rollback', () => respond(() => safeOptimizer.rollback()));
}

function readChanges(value: unknown): Partial<RuntimeOptimizationConfig> {
  const source = object(value); const result: Partial<RuntimeOptimizationConfig> = {};
  const numeric = ['retrievalTopK', 'lexicalWeight', 'semanticWeight', 'contextBudgetTokens', 'retryCount', 'timeoutMs', 'skillRankingWeight'] as const;
  for (const key of numeric) if (source[key] !== undefined) { if (typeof source[key] !== 'number' || !Number.isFinite(source[key])) throw new Error(`${key} must be numeric.`); result[key] = source[key]; }
  if (source.modelChoice !== undefined) { if (source.modelChoice !== null && typeof source.modelChoice !== 'string') throw new Error('modelChoice must be a string or null.'); result.modelChoice = source.modelChoice as string | null; }
  if (Object.keys(source).some((key) => ![...numeric, 'modelChoice'].includes(key as typeof numeric[number] | 'modelChoice'))) throw new Error('Optimizer changes contain non-allow-listed parameters.');
  return result;
}
function object(value: unknown): Record<string, unknown> { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Payload must be an object.'); return value as Record<string, unknown>; }
function id(value: unknown, name: string) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(value)) throw new Error(`${name} is invalid.`); return value; }
