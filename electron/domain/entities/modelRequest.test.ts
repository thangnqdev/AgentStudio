import { describe, expect, it } from 'vitest';
import {
  AiProviderRequestError,
  buildModelAttemptPlan,
  isRetryableModelFailure,
  modelRetryDelayMs,
  normalizeModelResiliencePolicy,
} from './modelRequest.js';

describe('model request policy', () => {
  it('builds a stable primary and fallback attempt plan without duplicate models', () => {
    expect(buildModelAttemptPlan('primary', ['fallback', 'primary', ''], 1)).toEqual([
      'primary', 'primary', 'fallback', 'fallback',
    ]);
  });

  it('retries only transient provider failures', () => {
    expect(isRetryableModelFailure(new AiProviderRequestError('rate_limit', 'slow down'))).toBe(true);
    expect(isRetryableModelFailure(new AiProviderRequestError('authentication', 'bad key'))).toBe(false);
    expect(isRetryableModelFailure(new Error('unknown'))).toBe(false);
  });

  it('uses bounded retry-after or exponential delay', () => {
    const policy = normalizeModelResiliencePolicy({ baseDelayMs: 500, maximumDelayMs: 2_000 });
    expect(modelRetryDelayMs(new AiProviderRequestError('server', 'retry'), 3, policy)).toBe(2_000);
    expect(modelRetryDelayMs(new AiProviderRequestError('rate_limit', 'retry', { retryAfterMs: 900 }), 1, policy)).toBe(900);
    expect(modelRetryDelayMs(new AiProviderRequestError('rate_limit', 'retry', { retryAfterMs: 9_000 }), 1, policy)).toBe(2_000);
  });
});
