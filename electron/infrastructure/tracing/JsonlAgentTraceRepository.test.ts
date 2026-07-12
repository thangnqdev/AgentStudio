import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentTraceService } from '../../application/services/AgentTraceService.js';
import { AgentTaskService } from '../../application/usecases/AgentTaskService.js';
import type { AgentTaskCheckpoint, AgentTaskRecord, AgentTaskSummary } from '../../domain/entities/agentTask.js';
import type { IAgentTaskRepository } from '../../domain/ports/IAgentTaskRepository.js';
import { JsonlAgentTraceRepository } from './JsonlAgentTraceRepository.js';

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

describe('JsonlAgentTraceRepository integration', () => {
  it('keeps one trace across pause/resume and exports sanitized JSONL', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-trace-'));
    temporaryDirectories.push(directory);
    const tracePath = path.join(directory, 'traces.jsonl');
    const exportPath = path.join(directory, 'export.jsonl');
    const traceService = new AgentTraceService(new JsonlAgentTraceRepository(tracePath));
    const tasks = new MemoryTaskRepository();
    const taskService = new AgentTaskService(tasks, traceService);
    const created = await taskService.create({ messages: [{ id: 'user-1', sender: 'user', content: 'secret prompt must not be traced' }] }, '/private/workspace', 'sensitive retrieval');
    await traceService.recordSpan({ kind: 'tool_call', traceId: created.traceId, taskId: created.id, requestId: 'request-1', step: 3, startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:00.020Z', status: 'succeeded', toolName: 'read_file', risk: 'read', outcome: 'succeeded' });
    await taskService.pause(created.id, 'manual stop');
    const resumed = await taskService.resume(created.id, '/private/workspace');

    expect(resumed.traceId).toBe(created.traceId);
    const details = await traceService.get(created.traceId);
    expect(details?.trace.status).toBe('running');
    expect(details?.spans.find((span) => span.kind === 'tool_call')).toMatchObject({ taskId: created.id, traceId: created.traceId, step: 3 });
    expect(details?.spans.find((span) => span.kind === 'checkpoint')).toMatchObject({ taskId: created.id, traceId: created.traceId, checkpointStatus: 'paused', completedSteps: 0 });
    await traceService.exportJsonl(created.traceId, exportPath);
    const exported = await fs.readFile(exportPath, 'utf8');
    expect(exported).not.toContain('secret prompt');
    expect(exported).not.toContain('sensitive retrieval');
    expect(exported).not.toContain('/private/workspace');
    expect(exported.split('\n').filter(Boolean).every((line) => JSON.parse(line).traceId === created.traceId)).toBe(true);
  });
});

class MemoryTaskRepository implements IAgentTaskRepository {
  tasks: AgentTaskRecord[] = [];
  async create(record: AgentTaskRecord) { this.tasks = [record]; }
  async get(taskId: string) { return this.tasks.find((record) => record.id === taskId) ?? null; }
  async listResumable(_workspaceRoot: string): Promise<AgentTaskSummary[]> { return []; }
  async saveCheckpoint(checkpoint: AgentTaskCheckpoint) { this.tasks = this.tasks.map((record) => record.id === checkpoint.id ? { ...record, ...checkpoint } : record); }
  async recoverInterrupted() { return []; }
  async markPaused(taskId: string, reason?: string) { this.tasks = this.tasks.map((record) => record.id === taskId ? { ...record, status: 'paused', lastError: reason } : record); }
  async markFailed(taskId: string, error: string) { this.tasks = this.tasks.map((record) => record.id === taskId ? { ...record, status: 'failed', lastError: error } : record); }
}
