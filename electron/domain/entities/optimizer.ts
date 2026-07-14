export const OPTIMIZER_STATE_VERSION = 1;
export const OPTIMIZER_EVALUATION_VERSION = 1;

export type RuntimeOptimizationConfig = {
  retrievalTopK: number; lexicalWeight: number; semanticWeight: number; modelChoice: string | null;
  contextBudgetTokens: number; retryCount: number; timeoutMs: number; skillRankingWeight: number;
};
export type OptimizationEvaluation = {
  version: typeof OPTIMIZER_EVALUATION_VERSION; evaluatorId: string; evaluatorVersion: string; baselineRunId: string; candidateRunId: string;
  baselineScore: number; candidateScore: number; improvement: number; minimumImprovement: number; passed: boolean; configurationDigest: string; evaluatedAt: string;
};
export type OptimizationCandidate = {
  id: string; baseRevision: number; config: RuntimeOptimizationConfig; changedKeys: Array<keyof RuntimeOptimizationConfig>;
  status: 'draft' | 'evaluated' | 'promoted' | 'rejected'; createdAt: string; evaluation?: OptimizationEvaluation;
};
export type OptimizerHistoryEntry = { revision: number; config: RuntimeOptimizationConfig; reason: 'promotion' | 'rollback'; candidateId?: string; activatedAt: string };
export type OptimizerState = { version: typeof OPTIMIZER_STATE_VERSION; revision: number; active: RuntimeOptimizationConfig; candidates: OptimizationCandidate[]; history: OptimizerHistoryEntry[] };

export const DEFAULT_OPTIMIZATION_CONFIG: RuntimeOptimizationConfig = {
  retrievalTopK: 5, lexicalWeight: 0.5, semanticWeight: 0.5, modelChoice: null,
  contextBudgetTokens: 24_000, retryCount: 2, timeoutMs: 15_000, skillRankingWeight: 0.5,
};

export function assertOptimizationConfig(config: RuntimeOptimizationConfig, allowedModels?: string[]) {
  assertOnlyKeys(config, ['retrievalTopK', 'lexicalWeight', 'semanticWeight', 'modelChoice', 'contextBudgetTokens', 'retryCount', 'timeoutMs', 'skillRankingWeight']);
  if (!integerBetween(config.retrievalTopK, 1, 20)) throw new Error('retrievalTopK must be an integer from 1 to 20.');
  if (!numberBetween(config.lexicalWeight, 0, 1) || !numberBetween(config.semanticWeight, 0, 1) || Math.abs(config.lexicalWeight + config.semanticWeight - 1) > 0.000001) throw new Error('Retrieval weights must be within [0,1] and sum to one.');
  if (config.modelChoice !== null && (typeof config.modelChoice !== 'string' || !config.modelChoice || (allowedModels && !allowedModels.includes(config.modelChoice)))) throw new Error('modelChoice is not in the configured model allow-list.');
  if (!integerBetween(config.contextBudgetTokens, 2_048, 200_000)) throw new Error('contextBudgetTokens must be an integer from 2048 to 200000.');
  if (!integerBetween(config.retryCount, 0, 5)) throw new Error('retryCount must be an integer from 0 to 5.');
  if (!integerBetween(config.timeoutMs, 1_000, 30_000)) throw new Error('timeoutMs must be an integer from 1000 to 30000.');
  if (!numberBetween(config.skillRankingWeight, 0, 1)) throw new Error('skillRankingWeight must be within [0,1].');
}

export function assertOptimizerState(state: OptimizerState) {
  assertOnlyKeys(state, ['version', 'revision', 'active', 'candidates', 'history']);
  if (state.version !== OPTIMIZER_STATE_VERSION || !Number.isInteger(state.revision) || state.revision < 1) throw new Error('Optimizer state identity is invalid.');
  assertOptimizationConfig(state.active);
  for (const candidate of state.candidates) {
    assertOnlyKeys(candidate, ['id', 'baseRevision', 'config', 'changedKeys', 'status', 'createdAt', 'evaluation']);
    if (!candidate.id || !Number.isInteger(candidate.baseRevision) || candidate.baseRevision < 1 || !Number.isFinite(Date.parse(candidate.createdAt))) throw new Error('Optimization candidate identity is invalid.');
    assertOptimizationConfig(candidate.config);
    if (!['draft', 'evaluated', 'promoted', 'rejected'].includes(candidate.status) || candidate.changedKeys.length === 0 || candidate.changedKeys.some((key) => !Object.hasOwn(candidate.config, key))) throw new Error('Optimization candidate status is invalid.');
    if (candidate.evaluation) assertOptimizationEvaluation(candidate.evaluation, candidate.config);
    if ((candidate.status === 'evaluated' || candidate.status === 'promoted') && !candidate.evaluation?.passed) throw new Error('Optimization candidate status is invalid.');
    if (candidate.status === 'rejected' && candidate.evaluation?.passed !== false) throw new Error('Optimization candidate status is invalid.');
  }
  for (const entry of state.history) {
    assertOnlyKeys(entry, ['revision', 'config', 'reason', 'candidateId', 'activatedAt']);
    if (!Number.isInteger(entry.revision) || entry.revision < 1 || !['promotion', 'rollback'].includes(entry.reason) || !Number.isFinite(Date.parse(entry.activatedAt))) throw new Error('Optimizer history is invalid.');
    assertOptimizationConfig(entry.config);
  }
}

export function configurationDigest(config: RuntimeOptimizationConfig) {
  assertOptimizationConfig(config);
  let hash = 2_166_136_261;
  for (const character of JSON.stringify(config)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16_777_619); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function assertOptimizationEvaluation(evaluation: OptimizationEvaluation, config: RuntimeOptimizationConfig) {
  assertOnlyKeys(evaluation, ['version', 'evaluatorId', 'evaluatorVersion', 'baselineRunId', 'candidateRunId', 'baselineScore', 'candidateScore', 'improvement', 'minimumImprovement', 'passed', 'configurationDigest', 'evaluatedAt']);
  const improvement = evaluation.candidateScore - evaluation.baselineScore;
  if (evaluation.version !== OPTIMIZER_EVALUATION_VERSION || !evaluation.evaluatorId || !evaluation.evaluatorVersion || !evaluation.baselineRunId || !evaluation.candidateRunId || !Number.isFinite(Date.parse(evaluation.evaluatedAt))) throw new Error('Optimization evaluation provenance is invalid.');
  if (![evaluation.baselineScore, evaluation.candidateScore].every((score) => numberBetween(score, 0, 1)) || evaluation.minimumImprovement <= 0 || Math.abs(evaluation.improvement - improvement) > 0.000001) throw new Error('Optimization evaluation scores are invalid.');
  if (evaluation.passed !== (improvement >= evaluation.minimumImprovement) || evaluation.configurationDigest !== configurationDigest(config)) throw new Error('Optimization evaluation decision is invalid.');
}

function assertOnlyKeys(value: object, keys: string[]) { const allowed = new Set(keys); if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('Optimizer object contains non-allow-listed fields.'); }
function integerBetween(value: number, minimum: number, maximum: number) { return Number.isInteger(value) && value >= minimum && value <= maximum; }
function numberBetween(value: number, minimum: number, maximum: number) { return Number.isFinite(value) && value >= minimum && value <= maximum; }
