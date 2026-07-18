import { describe, expect, it } from 'vitest';
import { CompositeAgentAmbientContextSource } from './CompositeAgentAmbientContextSource.js';

describe('CompositeAgentAmbientContextSource', () => {
  it('joins non-empty ambient sources in stable order', async () => {
    const source = new CompositeAgentAmbientContextSource([
      { drain: async () => 'diagnostics' },
      { drain: () => '' },
      { drain: () => 'IDE selection' },
    ]);
    await expect(source.drain('/workspace', { requestId: 'request-1', permissionMode: 'read-only' }))
      .resolves.toBe('diagnostics\n\nIDE selection');
  });
});
