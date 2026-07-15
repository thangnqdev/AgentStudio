import { describe, expect, it } from 'vitest';
import { compactContext } from './contextCompaction.js';

describe('compactContext historical actions', () => {
  it('counts and summarizes old tool actions instead of silently losing their results', () => {
    const messages = [
      {
        sender: 'agent' as const,
        content: 'Started background work.',
        actions: [{ toolName: 'run_command', args: 'background command', status: 'ok', output: '<task_id>bg-summary</task_id>' }],
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        sender: (index % 2 ? 'agent' : 'user') as 'agent' | 'user',
        content: `recent-${index} ${'x'.repeat(1_000)}`,
      })),
    ];
    const result = compactContext(messages, 1_200);
    expect(result.didCompact).toBe(true);
    expect(result.summary).toContain('run_command');
    expect(result.summary).toContain('bg-summary');
  });
});
