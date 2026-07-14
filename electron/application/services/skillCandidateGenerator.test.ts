import { describe, expect, it } from 'vitest';
import { generateSkillCandidate } from './skillCandidateGenerator.js';
import { successfulTrace } from '../../test/fixtures/skillLearningTrace.js';
import type { AgentTraceDetails } from '../../domain/entities/agentTrace.js';

describe('generateSkillCandidate', () => {
  it('creates tests and instructions only from sanitized successful tool metadata', () => {
    const candidate = generateSkillCandidate(successfulTrace(), 'candidate-1', '2026-01-01T00:00:00.000Z');
    expect(candidate.toolSequence).toEqual(['read_file', 'apply_patch']);
    expect(candidate.tests.map((test) => test.kind)).toEqual(['source_succeeded', 'tool_sequence_represented', 'bounded_instructions', 'no_policy_override']);
    expect(candidate.instructions).toContain('`read_file`'); expect(candidate.instructions).not.toContain('private content'); expect(candidate.instructions).not.toContain('/workspace');
  });
  it('preserves repeated tool steps (does not deduplicate via Set)', () => {
    // TDD cycle: read → patch → test → patch → test should NOT collapse to read → patch → test
    const trace: AgentTraceDetails = {
      trace: { recordType: 'trace', version: 1, traceId: 'trace-tdd', taskId: 'task-2', status: 'succeeded', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:05.000Z' },
      spans: [
        makeToolSpan('read_file', 0),
        makeToolSpan('apply_patch', 1),
        makeToolSpan('run_command', 2),
        makeToolSpan('apply_patch', 3), // repeated
        makeToolSpan('run_command', 4), // repeated
      ],
    };
    const candidate = generateSkillCandidate(trace, 'candidate-2', '2026-01-01T00:00:00.000Z');
    expect(candidate.toolSequence).toEqual(['read_file', 'apply_patch', 'run_command', 'apply_patch', 'run_command']);
    expect(candidate.instructions).toMatch(/3\. Consider the `run_command`/);
    expect(candidate.instructions).toMatch(/4\. Consider the `apply_patch`/);
    expect(candidate.instructions).toMatch(/5\. Consider the `run_command`/);
  });
  it('rejects failed or tool-free trajectories', () => {
    expect(() => generateSkillCandidate(successfulTrace('failed'), 'candidate-1', new Date().toISOString())).toThrow('succeeded');
    const empty = successfulTrace(); empty.spans = [];
    expect(() => generateSkillCandidate(empty, 'candidate-1', new Date().toISOString())).toThrow('no reusable');
  });
});

function makeToolSpan(toolName: string, step: number) {
  return { recordType: 'span' as const, version: 1 as const, kind: 'tool_call' as const, spanId: `span-${step}`, traceId: 'trace-tdd', taskId: 'task-2', step, startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:00.010Z', durationMs: 10, status: 'succeeded' as const, toolName, risk: 'read' as const, outcome: 'succeeded' as const };
}
