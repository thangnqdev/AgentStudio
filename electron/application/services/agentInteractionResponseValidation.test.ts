import { describe, expect, it } from 'vitest';
import { parseAgentInteractionResponse } from './agentInteractionResponseValidation.js';

describe('parseAgentInteractionResponse', () => {
  it('keeps only a strict bounded response contract', () => {
    expect(parseAgentInteractionResponse({
      requestId: 'request-1', interactionId: 'interaction-1',
      response: {
        accepted: true,
        answers: { 'Which approach?': 'Adapter' },
        annotations: { 'Which approach?': { preview: '**Adapter**', notes: 'Prefer ports.' } },
      },
    })).toEqual({
      requestId: 'request-1', interactionId: 'interaction-1',
      response: {
        accepted: true,
        answers: { 'Which approach?': 'Adapter' },
        annotations: { 'Which approach?': { preview: '**Adapter**', notes: 'Prefer ports.' } },
      },
    });
  });

  it('rejects invalid identities, extra fields, and oversized answers', () => {
    expect(parseAgentInteractionResponse({ requestId: '../bad', interactionId: 'i', response: { accepted: false } })).toBeNull();
    expect(parseAgentInteractionResponse({ requestId: 'r', interactionId: 'i', response: { accepted: false }, extra: true })).toBeNull();
    expect(parseAgentInteractionResponse({ requestId: 'r', interactionId: 'i', response: { accepted: true, answers: { q: 'x'.repeat(2_001) } } })).toBeNull();
  });
});
