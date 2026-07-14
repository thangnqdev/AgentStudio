import { describe, expect, it } from 'vitest';
import { MAX_OUTPUT_CONTINUATIONS, shouldContinueModelOutput } from './outputContinuation.js';

describe('output continuation policy', () => {
  it('continues length-limited output up to the bounded recovery count', () => {
    expect(shouldContinueModelOutput('length', 0)).toBe(true);
    expect(shouldContinueModelOutput('length', MAX_OUTPUT_CONTINUATIONS)).toBe(false);
    expect(shouldContinueModelOutput('stop', 0)).toBe(false);
  });
});
