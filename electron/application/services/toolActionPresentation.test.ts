import { describe, expect, it } from 'vitest';
import { summarizeToolArguments } from './toolActionPresentation.js';

describe('summarizeToolArguments', () => {
  it('does not expose write_file content in the action summary', () => {
    expect(summarizeToolArguments('write_file', { path: 'src/secret.ts', content: 'very secret value' })).toBe('path=src/secret.ts (17 bytes)');
  });
});
