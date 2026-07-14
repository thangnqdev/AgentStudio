import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentTaskRecord } from '../../domain/entities/agentTask.js';
import { JsonlAgentTaskRepository } from './JsonlAgentTaskRepository.js';

let root = '';
let journalPath = '';
let legacyPath = '';

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-task-journal-'));
  journalPath = path.join(root, 'tasks.jsonl');
  legacyPath = path.join(root, 'tasks.json');
});

afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

function task(id = 'task-1'): AgentTaskRecord {
  return {
    id, traceId: `trace-${id}`, title: id, workspaceRoot: '/workspace', status: 'running',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', completedSteps: 0,
    messages: [{ id: 'user', sender: 'user', content: 'hello' }], conversation: [],
  };
}

function repository() { return new JsonlAgentTaskRepository({ journalPath, legacyPath, compactAfterBytes: 1_000_000 }); }

describe('JsonlAgentTaskRepository', () => {
  it('replays append-only checkpoint deltas in a fresh repository instance', async () => {
    const first = repository();
    const created = task();
    await first.create(created);
    await first.saveCheckpoint({
      id: created.id, traceId: created.traceId, workspaceRoot: created.workspaceRoot, status: 'paused', completedSteps: 1,
      messages: [...created.messages, { id: 'agent', sender: 'agent', content: 'done' }],
      conversation: [{ role: 'assistant', content: 'done' }],
    });
    const restored = await repository().get(created.id);
    expect(restored).toMatchObject({ status: 'paused', completedSteps: 1 });
    expect(restored?.messages).toHaveLength(2);
    const entries = (await fs.readFile(journalPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    expect(entries.map((entry) => entry.kind)).toEqual(['snapshot', 'checkpoint']);
    expect(entries[1].messages).toMatchObject({ mode: 'append', values: [{ id: 'agent' }] });
  });

  it('ignores only a torn final journal line', async () => {
    const store = repository();
    await store.create(task());
    await fs.appendFile(journalPath, '{"version":1,"kind":"checkpoint"');
    expect(await repository().get('task-1')).toMatchObject({ id: 'task-1', status: 'running' });
    await repository().create(task('after-repair'));
    expect(await repository().get('task-1')).toMatchObject({ id: 'task-1' });
    expect(await repository().get('after-repair')).toMatchObject({ id: 'after-repair' });
  });

  it('seeds the journal from the legacy snapshot before appending new tasks', async () => {
    await fs.writeFile(legacyPath, JSON.stringify({ tasks: [task('legacy')] }));
    const store = repository();
    await store.create(task('new'));
    expect(await repository().get('legacy')).toMatchObject({ id: 'legacy' });
    expect(await repository().get('new')).toMatchObject({ id: 'new' });
  });

  it('recovers running tasks as paused durable checkpoints', async () => {
    const store = repository();
    await store.create(task());
    expect(await store.recoverInterrupted()).toMatchObject([{ status: 'paused', lastError: expect.stringContaining('đã đóng') }]);
    expect(await repository().get('task-1')).toMatchObject({ status: 'paused' });
  });
});
