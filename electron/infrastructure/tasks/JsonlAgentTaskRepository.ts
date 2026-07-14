import { app } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ChatMessage, Message } from '../../domain/entities/agent.js';
import type { AgentTaskCheckpoint, AgentTaskRecord, AgentTaskSummary } from '../../domain/entities/agentTask.js';
import { summarizeAgentTask } from '../../domain/entities/agentTask.js';
import type { IAgentTaskRepository } from '../../domain/ports/IAgentTaskRepository.js';
import { appendPrivateLine, writePrivateFileAtomic } from '../storage/privateFile.js';

const JOURNAL_VERSION = 1;
const DEFAULT_COMPACT_AFTER_BYTES = 25_000_000;
const MAX_COMPACTED_TASKS = 100;

type ArrayChange<T> = { mode: 'append' | 'replace'; values: T[] };
type CheckpointFields = Omit<AgentTaskCheckpoint, 'messages' | 'conversation'>;
type JournalBase = { version: typeof JOURNAL_VERSION; eventId: string; recordedAt: string };
type TaskJournalEntry =
  | JournalBase & { kind: 'snapshot'; task: AgentTaskRecord }
  | JournalBase & {
    kind: 'checkpoint'; taskId: string; fields: CheckpointFields;
    messages: ArrayChange<Message>; conversation: ArrayChange<ChatMessage>;
  };

type RepositoryOptions = {
  journalPath?: string;
  legacyPath?: string;
  compactAfterBytes?: number;
};

export class JsonlAgentTaskRepository implements IAgentTaskRepository {
  private queue = Promise.resolve();
  private readonly options: RepositoryOptions;

  constructor(options: RepositoryOptions = {}) {
    this.options = options;
  }

  create(task: AgentTaskRecord) {
    return this.exclusive(async () => {
      const tasks = await this.readUnlocked();
      await this.seedJournalIfNeeded(tasks);
      tasks.set(task.id, structuredClone(task));
      await this.append(snapshotEntry(task), tasks);
    });
  }

  async get(taskId: string) {
    await this.queue;
    return structuredClone((await this.readUnlocked()).get(taskId) ?? null);
  }

  async listResumable(workspaceRoot: string): Promise<AgentTaskSummary[]> {
    await this.queue;
    return [...(await this.readUnlocked()).values()]
      .filter((task) => task.workspaceRoot === workspaceRoot && (task.status === 'paused' || task.status === 'failed'))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 12)
      .map(summarizeAgentTask);
  }

  saveCheckpoint(checkpoint: AgentTaskCheckpoint) {
    return this.exclusive(async () => {
      const tasks = await this.readUnlocked();
      await this.seedJournalIfNeeded(tasks);
      const previous = tasks.get(checkpoint.id);
      if (!previous) throw new Error('Cannot checkpoint an unknown agent task.');
      const entry = checkpointEntry(previous, checkpoint);
      tasks.set(checkpoint.id, applyCheckpoint(previous, entry));
      await this.append(entry, tasks);
    });
  }

  recoverInterrupted() {
    return this.exclusive(async () => {
      const tasks = await this.readUnlocked();
      await this.seedJournalIfNeeded(tasks);
      const recovered: AgentTaskRecord[] = [];
      for (const task of tasks.values()) {
        if (task.status !== 'running') continue;
        const checkpoint = toCheckpoint(task, 'paused', 'Ứng dụng đã đóng trước khi tác vụ hoàn tất.');
        const entry = checkpointEntry(task, checkpoint);
        const next = applyCheckpoint(task, entry);
        tasks.set(task.id, next);
        recovered.push(structuredClone(next));
        await this.append(entry, tasks);
      }
      return recovered;
    });
  }

  markFailed(taskId: string, error: string) {
    return this.markStatus(taskId, 'failed', error.slice(0, 1_000));
  }

  markPaused(taskId: string, reason?: string) {
    return this.markStatus(taskId, 'paused', reason);
  }

  private markStatus(taskId: string, status: 'failed' | 'paused', lastError?: string) {
    return this.exclusive(async () => {
      const tasks = await this.readUnlocked();
      await this.seedJournalIfNeeded(tasks);
      const task = tasks.get(taskId);
      if (!task) return;
      const entry = checkpointEntry(task, toCheckpoint(task, status, lastError));
      tasks.set(taskId, applyCheckpoint(task, entry));
      await this.append(entry, tasks);
    });
  }

  private async readUnlocked() {
    const entries = await this.readJournal();
    if (entries) return foldJournal(entries);
    return this.readLegacyTasks();
  }

  private async readJournal(): Promise<TaskJournalEntry[] | null> {
    try {
      const lines = (await fs.readFile(this.journalPath(), 'utf8')).split('\n').filter(Boolean);
      const entries: TaskJournalEntry[] = [];
      for (let index = 0; index < lines.length; index += 1) {
        let parsed: unknown;
        try { parsed = JSON.parse(lines[index]); }
        catch (error) {
          if (index === lines.length - 1) break;
          throw new Error(`Agent task journal is corrupt at line ${index + 1}.`, { cause: error });
        }
        entries.push(parseEntry(parsed));
      }
      return entries;
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  private async readLegacyTasks() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.legacyPath(), 'utf8')) as { tasks?: AgentTaskRecord[] };
      if (!Array.isArray(parsed.tasks)) throw new Error('Legacy task store has an invalid shape.');
      return new Map(parsed.tasks.map((task) => [task.id, withLegacyTraceId(task)]));
    } catch (error) {
      if (missing(error)) return new Map<string, AgentTaskRecord>();
      throw new Error('Legacy agent task store is invalid.', { cause: error });
    }
  }

  private async seedJournalIfNeeded(tasks: Map<string, AgentTaskRecord>) {
    if (await exists(this.journalPath()) || tasks.size === 0) return;
    const content = [...tasks.values()].map((task) => JSON.stringify(snapshotEntry(task))).join('\n');
    await writePrivateFileAtomic(this.journalPath(), `${content}\n`);
  }

  private async append(entry: TaskJournalEntry, tasks: Map<string, AgentTaskRecord>) {
    await this.repairTornJournalTail();
    await appendPrivateLine(this.journalPath(), `${JSON.stringify(entry)}\n`);
    const stat = await fs.stat(this.journalPath());
    if (stat.size <= (this.options.compactAfterBytes ?? DEFAULT_COMPACT_AFTER_BYTES)) return;
    const recent = [...tasks.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_COMPACTED_TASKS);
    await writePrivateFileAtomic(this.journalPath(), `${recent.map((task) => JSON.stringify(snapshotEntry(task))).join('\n')}\n`);
  }

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  private async repairTornJournalTail() {
    let buffer: Buffer;
    try { buffer = await fs.readFile(this.journalPath()); }
    catch (error) { if (missing(error)) return; throw error; }
    if (buffer.length === 0 || buffer[buffer.length - 1] === 10) return;
    const lastNewline = buffer.lastIndexOf(10);
    const tail = buffer.subarray(lastNewline + 1).toString('utf8');
    let parsed: unknown;
    try { parsed = JSON.parse(tail); }
    catch {
      await fs.truncate(this.journalPath(), lastNewline + 1);
      return;
    }
    parseEntry(parsed);
    await fs.appendFile(this.journalPath(), '\n', { encoding: 'utf8', mode: 0o600 });
  }

  private journalPath() { return this.options.journalPath ?? path.join(app.getPath('userData'), 'agent-tasks.jsonl'); }
  private legacyPath() { return this.options.legacyPath ?? path.join(app.getPath('userData'), 'agent-tasks.json'); }
}

function snapshotEntry(task: AgentTaskRecord): TaskJournalEntry {
  return { version: JOURNAL_VERSION, eventId: randomUUID(), recordedAt: new Date().toISOString(), kind: 'snapshot', task: structuredClone(task) };
}

function checkpointEntry(previous: AgentTaskRecord, checkpoint: AgentTaskCheckpoint): Extract<TaskJournalEntry, { kind: 'checkpoint' }> {
  const { messages, conversation, ...fields } = structuredClone(checkpoint);
  return {
    version: JOURNAL_VERSION, eventId: randomUUID(), recordedAt: new Date().toISOString(), kind: 'checkpoint', taskId: checkpoint.id, fields,
    messages: arrayChange(previous.messages, messages), conversation: arrayChange(previous.conversation, conversation),
  };
}

function applyCheckpoint(previous: AgentTaskRecord, entry: Extract<TaskJournalEntry, { kind: 'checkpoint' }>): AgentTaskRecord {
  return {
    ...previous, ...entry.fields, updatedAt: entry.recordedAt,
    messages: applyArrayChange(previous.messages, entry.messages),
    conversation: applyArrayChange(previous.conversation, entry.conversation),
  };
}

function foldJournal(entries: TaskJournalEntry[]) {
  const tasks = new Map<string, AgentTaskRecord>();
  for (const entry of entries) {
    if (entry.kind === 'snapshot') tasks.set(entry.task.id, structuredClone(entry.task));
    else {
      const previous = tasks.get(entry.taskId);
      if (!previous) throw new Error(`Checkpoint references unknown task ${entry.taskId}.`);
      tasks.set(entry.taskId, applyCheckpoint(previous, entry));
    }
  }
  return tasks;
}

function parseEntry(raw: unknown): TaskJournalEntry {
  const value = raw as TaskJournalEntry;
  if (!value || value.version !== JOURNAL_VERSION || !value.eventId || !Number.isFinite(Date.parse(value.recordedAt))) throw new Error('Invalid journal envelope.');
  if (value.kind === 'snapshot' && value.task?.id) return value;
  if (value.kind === 'checkpoint' && value.taskId && value.fields?.id === value.taskId && Array.isArray(value.messages?.values) && Array.isArray(value.conversation?.values)) return value;
  throw new Error('Invalid journal event.');
}

function arrayChange<T>(previous: T[], next: T[]): ArrayChange<T> {
  return isPrefix(previous, next) ? { mode: 'append', values: structuredClone(next.slice(previous.length)) } : { mode: 'replace', values: structuredClone(next) };
}

function applyArrayChange<T>(previous: T[], change: ArrayChange<T>) {
  return change.mode === 'append' ? [...previous, ...structuredClone(change.values)] : structuredClone(change.values);
}

function isPrefix<T>(previous: T[], next: T[]) {
  return previous.length <= next.length && previous.every((value, index) => JSON.stringify(value) === JSON.stringify(next[index]));
}

function toCheckpoint(task: AgentTaskRecord, status: 'paused' | 'failed', lastError?: string): AgentTaskCheckpoint {
  return { id: task.id, traceId: task.traceId, workspaceRoot: task.workspaceRoot, status, completedSteps: task.completedSteps, messages: task.messages, conversation: task.conversation, knowledgeContext: task.knowledgeContext, lastError };
}

function withLegacyTraceId(task: AgentTaskRecord) {
  return { ...task, traceId: task.traceId || createHash('sha256').update(`legacy-task:${task.id}`).digest('hex').slice(0, 32) };
}

async function exists(target: string) { try { await fs.access(target); return true; } catch { return false; } }
function missing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
