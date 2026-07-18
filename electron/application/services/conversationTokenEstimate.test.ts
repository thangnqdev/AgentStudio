import { describe, expect, it } from 'vitest';
import { estimateConversationTokens } from './conversationTokenEstimate.js';

describe('estimateConversationTokens', () => {
  it('counts multimodal images by a bounded visual estimate instead of base64 length', () => {
    const base64 = 'a'.repeat(2_000_000);
    const estimate = estimateConversationTokens([{
      role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } }],
    }]);
    expect(estimate).toBeGreaterThanOrEqual(1_000);
    expect(estimate).toBeLessThan(2_000);
  });

  it('still accounts for ordinary textual conversation content', () => {
    expect(estimateConversationTokens([{ role: 'user', content: 'x'.repeat(4_000) }])).toBeGreaterThanOrEqual(1_000);
  });
});
