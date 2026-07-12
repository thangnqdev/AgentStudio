import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentTraceService } from '../../application/services/AgentTraceService.js';
import { JsonlAgentTraceRepository } from '../tracing/JsonlAgentTraceRepository.js';
import { TraceCapabilityMetricsProvider } from './TraceCapabilityMetricsProvider.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

describe('TraceCapabilityMetricsProvider integration', () => {
  it('folds sanitized tool and retrieval spans into reliability and latency', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'capability-metrics-')); directories.push(directory);
    const repository = new JsonlAgentTraceRepository(path.join(directory, 'traces.jsonl'));
    const service = new AgentTraceService(repository);
    await service.startTrace('trace-1', 'task-1');
    await service.recordSpan(span('succeeded', 'succeeded', 10));
    await service.recordSpan(span('failed', 'blocked', 30));
    await service.recordSpan({ kind: 'retrieval', traceId: 'trace-1', taskId: 'task-1', startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:00.040Z', status: 'succeeded', mode: 'hybrid', resultCount: 3 });
    const result = await new TraceCapabilityMetricsProvider(repository).getMetrics(['tool:read_file', 'knowledge:retrieval', 'terminal:pty']);
    expect(result.get('tool:read_file')).toMatchObject({ sampleCount: 2, successRate: 0.5, meanLatencyMs: 20, p95LatencyMs: 30, failureTypes: { blocked: 1 } });
    expect(result.get('knowledge:retrieval')).toMatchObject({ sampleCount: 1, successRate: 1, meanLatencyMs: 40 });
    expect(result.get('terminal:pty')).toMatchObject({ sampleCount: 0, successRate: null });
  });
});

function span(status: 'succeeded' | 'failed', outcome: 'succeeded' | 'blocked', durationMs: number) {
  return { kind: 'tool_call' as const, traceId: 'trace-1', taskId: 'task-1', startedAt: '2026-01-01T00:00:00.000Z', endedAt: new Date(Date.parse('2026-01-01T00:00:00.000Z') + durationMs).toISOString(), status, toolName: 'read_file', risk: 'read' as const, outcome };
}
