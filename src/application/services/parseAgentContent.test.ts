import { describe, expect, it } from 'vitest';
import { parseAgentContent } from './parseAgentContent';

describe('parseAgentContent', () => {
  it('keeps assistant Markdown after a tool marker as text, not tool output', () => {
    const parts = parseAgentContent('[tool:tooluse-1]\n\n## Review\nThe task is complete.');

    expect(parts).toEqual([
      { type: 'tool', actionId: 'tooluse-1' },
      { type: 'text', value: '\n\n## Review\nThe task is complete.' },
    ]);
  });

  it('keeps thinking and fenced code boundaries intact', () => {
    const parts = parseAgentContent('<think>plan</think>\n[tool:tooluse-2]\n```ts\nconst done = true;\n```');

    expect(parts.map((part) => part.type)).toEqual(['think', 'text', 'tool', 'text', 'code']);
  });
});
