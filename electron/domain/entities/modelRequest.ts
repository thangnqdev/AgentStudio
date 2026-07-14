export type AiProviderFailureKind =
  | 'aborted'
  | 'timeout'
  | 'rate_limit'
  | 'overloaded'
  | 'server'
  | 'network'
  | 'authentication'
  | 'invalid_request'
  | 'unknown';

export class AiProviderRequestError extends Error {
  readonly kind: AiProviderFailureKind;
  readonly statusCode?: number;
  readonly retryAfterMs?: number;

  constructor(
    kind: AiProviderFailureKind,
    message: string,
    options?: { statusCode?: number; retryAfterMs?: number; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AiProviderRequestError';
    this.kind = kind;
    this.statusCode = options?.statusCode;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export type ModelResiliencePolicy = {
  retryCount: number;
  requestTimeoutMs: number;
  baseDelayMs: number;
  maximumDelayMs: number;
};

export const DEFAULT_MODEL_RESILIENCE_POLICY: ModelResiliencePolicy = {
  retryCount: 2,
  requestTimeoutMs: 300_000,
  baseDelayMs: 500,
  maximumDelayMs: 30_000,
};

export function normalizeModelResiliencePolicy(input: Partial<ModelResiliencePolicy>): ModelResiliencePolicy {
  return {
    retryCount: integerBetween(input.retryCount, 0, 5, DEFAULT_MODEL_RESILIENCE_POLICY.retryCount),
    requestTimeoutMs: integerBetween(input.requestTimeoutMs, 1, 600_000, DEFAULT_MODEL_RESILIENCE_POLICY.requestTimeoutMs),
    baseDelayMs: integerBetween(input.baseDelayMs, 0, 30_000, DEFAULT_MODEL_RESILIENCE_POLICY.baseDelayMs),
    maximumDelayMs: integerBetween(input.maximumDelayMs, 0, 300_000, DEFAULT_MODEL_RESILIENCE_POLICY.maximumDelayMs),
  };
}

export function buildModelAttemptPlan(primaryModel: string, fallbackModels: string[], retryCount: number): string[] {
  const models = [...new Set([primaryModel, ...fallbackModels].map((model) => model.trim()).filter(Boolean))];
  const attemptsPerModel = Math.max(1, Math.min(Math.trunc(retryCount) + 1, 6));
  return models.flatMap((model) => Array.from({ length: attemptsPerModel }, () => model));
}

export function isRetryableModelFailure(error: unknown): error is AiProviderRequestError {
  return error instanceof AiProviderRequestError
    && ['timeout', 'rate_limit', 'overloaded', 'server', 'network'].includes(error.kind);
}

export function modelRetryDelayMs(error: AiProviderRequestError, failedAttempt: number, policy: ModelResiliencePolicy) {
  if (typeof error.retryAfterMs === 'number' && Number.isFinite(error.retryAfterMs)) {
    return Math.min(Math.max(error.retryAfterMs, 0), policy.maximumDelayMs);
  }
  const exponential = policy.baseDelayMs * (2 ** Math.max(0, failedAttempt - 1));
  return Math.min(exponential, policy.maximumDelayMs);
}

function integerBetween(value: number | undefined, minimum: number, maximum: number, fallback: number) {
  return Number.isInteger(value) && value! >= minimum && value! <= maximum ? value! : fallback;
}
