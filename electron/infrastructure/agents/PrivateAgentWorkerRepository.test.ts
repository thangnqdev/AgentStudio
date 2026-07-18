import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import { PrivateAgentWorkerRepository } from './PrivateAgentWorkerRepository.js';

let directory = '';
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-workers-')); });
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

describe('PrivateAgentWorkerRepository', () => {
  it('persists hashed private transcripts, queues, and notifications', async () => {
    const repository = new PrivateAgentWorkerRepository(directory);
    const record = worker();
    await repository.create(record);
    await repository.enqueueMessage(record.id, { id: 'message-1', sender: 'user', content: 'Continue' });
    expect(await repository.drainMessages(record.id)).toEqual([{ id: 'message-1', sender: 'user', content: 'Continue' }]);
    await repository.addNotification({ id: 'notice-1', parentScopeId: record.parentScopeId, agentId: record.id, status: 'completed', message: 'Done', createdAt: record.createdAt });
    expect(await repository.drainNotifications(record.parentScopeId)).toHaveLength(1);
    expect(await repository.drainNotifications(record.parentScopeId)).toEqual([]);
    const workerFiles = await fs.readdir(path.join(directory, 'workers'));
    expect(workerFiles).toEqual([expect.stringMatching(/^[a-f0-9]{64}\.json$/)]);
    expect(workerFiles[0]).not.toContain(record.id);
    expect((await fs.stat(path.join(directory, 'workers', workerFiles[0]))).mode & 0o777).toBe(0o600);
  });

  it('recovers interrupted workers as paused without losing transcript', async () => {
    const repository = new PrivateAgentWorkerRepository(directory);
    await repository.create(worker());
    const recovered = await repository.recoverInterrupted();
    expect(recovered[0]).toMatchObject({ status: 'paused', error: 'Application closed before this agent completed.' });
    expect((await repository.get('agent-1'))?.messages[0].content).toBe('Do work');
  });

  it('acks claimed mail only after it reaches a durable checkpoint', async () => {
    const repository = new PrivateAgentWorkerRepository(directory);
    const record = worker();
    const message = { id: 'message-ack', sender: 'user' as const, content: 'Persist me' };
    await repository.create(record); await repository.enqueueMessage(record.id, message);
    expect(await repository.drainMessages(record.id)).toEqual([message]);
    expect(await repository.drainMessages(record.id)).toEqual([]);
    await repository.saveCheckpoint({
      id: record.id, status: 'running', updatedAt: record.updatedAt, completedSteps: 1,
      messages: [...record.messages, message], conversation: [{ role: 'user', content: message.content }],
    });
    expect(await repository.drainMessages(record.id)).toEqual([]);
  });

  it('releases unacked mail claims during interrupted-process recovery', async () => {
    const repository = new PrivateAgentWorkerRepository(directory);
    const record = worker();
    const message = { id: 'message-recover', sender: 'user' as const, content: 'Redeliver me' };
    await repository.create(record); await repository.enqueueMessage(record.id, message);
    expect(await repository.drainMessages(record.id)).toEqual([message]);
    await repository.recoverInterrupted();
    expect(await repository.drainMessages(record.id)).toEqual([message]);
  });
});

function worker(): AgentWorkerRecord {
  return {
    id: 'agent-1', traceId: 'trace-1', parentScopeId: 'scope-1', description: 'Run focused review', prompt: 'Do work',
    permissionMode: 'workspace-write', workspaceRoot: '/workspace', depth: 1, background: true, status: 'running',
    createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z', completedSteps: 0,
    messages: [{ id: 'prompt-1', sender: 'user', content: 'Do work' }], conversation: [],
  };
}
