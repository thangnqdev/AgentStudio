import { describe, expect, it } from 'vitest';
import { createProviderHttpError, createProviderTransportError } from './OpenAIProviderErrors.js';

describe('OpenAI provider errors', () => {
  it('classifies retryable status codes and parses Retry-After', () => {
    expect(createProviderHttpError(429, 'limited', '1.5')).toMatchObject({ kind: 'rate_limit', retryAfterMs: 1_500 });
    expect(createProviderHttpError(529, 'busy', null)).toMatchObject({ kind: 'overloaded' });
    expect(createProviderHttpError(503, 'down', null)).toMatchObject({ kind: 'server' });
  });

  it('does not classify authentication and invalid request failures as transient', () => {
    expect(createProviderHttpError(401, 'bad key', null)).toMatchObject({ kind: 'authentication' });
    expect(createProviderHttpError(400, 'bad request', null)).toMatchObject({ kind: 'invalid_request' });
    expect(createProviderTransportError(new Error('reset'))).toMatchObject({ kind: 'network' });
  });
});
