import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_CRON_JOBS,
  type CreateCronTaskInput,
  type CronScope,
  type CronTask,
} from '../../domain/entities/cron.js';
import { claimDueCronTasks } from '../../domain/entities/cronClaim.js';
import { nextCronFireAt, parseCronExpression } from '../../domain/entities/cronSchedule.js';
import type { ICronTaskRepository } from '../../domain/ports/ICronTaskRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';
import { acquirePrivateCronScopeLock } from './PrivateCronScopeLock.js';

const VERSION = 1;
const MAX_CRON_FILE_BYTES = 5_000_000;
const queues = new Map<string, Promise<void>>();
const sessionTasks = new Map<string, CronTask[]>();
type CronEnvelope = { version: typeof VERSION; scope: CronScope; tasks: CronTask[] };

export class PrivateCronTaskRepository implements ICronTaskRepository {
  private readonly outputDirectory: string | (() => string);

  constructor(outputDirectory: string | (() => string)) {
    this.outputDirectory = outputDirectory;
  }

  create(scope: CronScope, input: CreateCronTaskInput, nowMs: number) {
    const normalized = normalizeScope(scope);
    return this.exclusive(normalized, async () => {
      validateCreateInput(input, normalized, nowMs);
      const durable = await this.readDurable(normalized);
      const activeSession = this.readSession(normalized);
      if (durable.length + activeSession.length >= MAX_CRON_JOBS) {
        throw new Error(`Too many scheduled jobs (max ${MAX_CRON_JOBS}). Cancel one first.`);
      }
      const id = allocateId([...durable, ...activeSession]);
      const task: CronTask = { id, ...structuredClone(input), createdAt: nowMs };
      if (task.durable) await this.writeDurable(normalized, [...durable, task]);
      else this.writeSession(normalized, [...activeSession, task]);
      return structuredClone(task);
    });
  }

  list(scope: CronScope) {
    const normalized = normalizeScope(scope);
    return this.exclusive(normalized, async () => {
      const tasks = [...await this.readDurable(normalized), ...this.readSession(normalized)]
        .sort((left, right) => left.createdAt - right.createdAt);
      return structuredClone(tasks);
    });
  }

  remove(scope: CronScope, id: string) {
    const normalized = normalizeScope(scope);
    return this.exclusive(normalized, async () => {
      validateId(id);
      const durable = await this.readDurable(normalized);
      const activeSession = this.readSession(normalized);
      const nextDurable = durable.filter((task) => task.id !== id);
      const nextSession = activeSession.filter((task) => task.id !== id);
      if (nextDurable.length !== durable.length) await this.writeDurable(normalized, nextDurable);
      if (nextSession.length !== activeSession.length) this.writeSession(normalized, nextSession);
      return nextDurable.length !== durable.length || nextSession.length !== activeSession.length;
    });
  }

  claimDue(scope: CronScope, nowMs: number) {
    const normalized = normalizeScope(scope);
    return this.exclusive(normalized, async () => {
      if (!Number.isFinite(nowMs)) throw new Error('Cron fire time is invalid.');
      const durable = claimDueCronTasks(await this.readDurable(normalized), nowMs);
      const activeSession = claimDueCronTasks(this.readSession(normalized), nowMs);
      if (durable.due.length) await this.writeDurable(normalized, durable.remaining);
      if (activeSession.due.length) this.writeSession(normalized, activeSession.remaining);
      return structuredClone([...durable.due, ...activeSession.due]);
    });
  }

  releaseClaim(scope: CronScope, task: CronTask) {
    const normalized = normalizeScope(scope);
    return this.exclusive(normalized, async () => {
      const restored = validateTaskForScope(task, normalized);
      const durable = await this.readDurable(normalized);
      const activeSession = this.readSession(normalized);
      if ([...durable, ...activeSession].some((item) => item.id === restored.id)) return;
      if (durable.length + activeSession.length >= MAX_CRON_JOBS) throw new Error('Unable to release cron claim because the job limit was reached.');
      if (restored.durable) await this.writeDurable(normalized, [...durable, restored]);
      else this.writeSession(normalized, [...activeSession, restored]);
    });
  }

  private async readDurable(scope: CronScope) {
    const target = this.filePath(scope);
    try {
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_CRON_FILE_BYTES) {
        throw new Error('Persisted cron file is unsafe.');
      }
      const value = JSON.parse(await fs.readFile(target, 'utf8')) as unknown;
      return validateEnvelope(value, scope).tasks;
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  private async writeDurable(scope: CronScope, tasks: CronTask[]) {
    await ensurePrivateDirectory(this.directory());
    const envelope: CronEnvelope = { version: VERSION, scope, tasks: tasks.map((task) => ({ ...task, durable: true })) };
    await writePrivateFileAtomic(this.filePath(scope), JSON.stringify(envelope));
  }

  private readSession(scope: CronScope) {
    return structuredClone(sessionTasks.get(this.sessionKey(scope)) ?? []);
  }

  private writeSession(scope: CronScope, tasks: CronTask[]) {
    const key = this.sessionKey(scope);
    if (tasks.length) sessionTasks.set(key, structuredClone(tasks));
    else sessionTasks.delete(key);
  }

  private exclusive<T>(scope: CronScope, operation: () => Promise<T>) {
    const key = this.filePath(scope);
    const previous = queues.get(key) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(async () => {
      await ensurePrivateDirectory(this.directory());
      const release = await acquirePrivateCronScopeLock(`${key}.lock`);
      try { return await operation(); } finally { await release(); }
    });
    const settled = result.then(() => undefined, () => undefined);
    queues.set(key, settled);
    void settled.finally(() => { if (queues.get(key) === settled) queues.delete(key); });
    return result;
  }

  private filePath(scope: CronScope) { return path.join(this.directory(), `${scopeDigest(scope)}.json`); }
  private sessionKey(scope: CronScope) { return `${this.directory()}:${scopeDigest(scope)}`; }
  private directory() { return path.resolve(typeof this.outputDirectory === 'function' ? this.outputDirectory() : this.outputDirectory); }
}

function normalizeScope(scope: CronScope): CronScope {
  validateText(scope.workspaceRoot, 'Cron workspace', 4_000);
  validateText(scope.scopeId, 'Cron scope', 256);
  validateText(scope.ownerId, 'Cron owner', 256);
  if (scope.ownerKind !== 'lead' && scope.ownerKind !== 'teammate') throw new Error('Cron owner kind is invalid.');
  return {
    workspaceRoot: path.resolve(scope.workspaceRoot),
    scopeId: scope.scopeId,
    ownerId: scope.ownerId,
    ownerKind: scope.ownerKind,
  };
}

function validateCreateInput(input: CreateCronTaskInput, scope: CronScope, nowMs: number) {
  validateText(input.cron, 'Cron expression', 1_000);
  if (!parseCronExpression(input.cron) || nextCronFireAt(input.cron, nowMs) === null) throw new Error('Cron expression is invalid.');
  if (typeof input.prompt !== 'string' || input.prompt.includes('\0') || input.prompt.length > 100_000) throw new Error('Cron prompt is invalid.');
  if (typeof input.recurring !== 'boolean' || typeof input.durable !== 'boolean' || !Number.isFinite(nowMs)) throw new Error('Cron task is invalid.');
  if (input.durable && scope.ownerKind === 'teammate') throw new Error('durable crons are not supported for teammates (teammates do not persist across sessions)');
}

function validateEnvelope(value: unknown, scope: CronScope): CronEnvelope {
  if (!isObject(value) || value.version !== VERSION || !sameScope(value.scope, scope) || !Array.isArray(value.tasks)) {
    throw new Error('Persisted cron file is invalid.');
  }
  if (value.tasks.length > MAX_CRON_JOBS) throw new Error('Persisted cron file has too many jobs.');
  return { version: VERSION, scope, tasks: value.tasks.map(validateTask) };
}

function validateTask(value: unknown): CronTask {
  if (!isObject(value) || typeof value.id !== 'string') throw new Error('Persisted cron task is invalid.');
  validateId(value.id); validateText(value.cron, 'Cron expression', 1_000);
  if (!parseCronExpression(value.cron) || typeof value.prompt !== 'string' || value.prompt.length > 100_000 || value.prompt.includes('\0')) throw new Error('Persisted cron task is invalid.');
  if (!Number.isFinite(value.createdAt) || (value.lastFiredAt !== undefined && !Number.isFinite(value.lastFiredAt))) throw new Error('Persisted cron timestamps are invalid.');
  if (typeof value.recurring !== 'boolean' || value.durable !== true) throw new Error('Persisted cron flags are invalid.');
  return structuredClone(value as CronTask);
}

function validateTaskForScope(value: unknown, scope: CronScope) {
  if (!isObject(value) || typeof value.durable !== 'boolean') throw new Error('Cron claim is invalid.');
  if (value.durable && scope.ownerKind === 'teammate') throw new Error('Durable teammate cron claim is invalid.');
  if (!value.durable) {
    const transient = { ...value, durable: true };
    return { ...validateTask(transient), durable: false };
  }
  return validateTask(value);
}

function allocateId(tasks: CronTask[]) {
  const existing = new Set(tasks.map((task) => task.id));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = randomUUID().replaceAll('-', '').slice(0, 8);
    if (!existing.has(id)) return id;
  }
  throw new Error('Unable to allocate a cron job ID.');
}

function scopeDigest(scope: CronScope) { return createHash('sha256').update(JSON.stringify(scope)).digest('hex'); }
function validateId(id: string) { if (!/^[a-f0-9]{8}$/i.test(id)) throw new Error('Cron job ID is invalid.'); }
function validateText(value: unknown, label: string, maximum: number): asserts value is string {
  if (typeof value !== 'string' || !value || value.includes('\0') || value.length > maximum) throw new Error(`${label} is invalid.`);
}
function sameScope(value: unknown, scope: CronScope) {
  return isObject(value)
    && value.workspaceRoot === scope.workspaceRoot
    && value.scopeId === scope.scopeId
    && value.ownerId === scope.ownerId
    && value.ownerKind === scope.ownerKind;
}
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isMissing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
async function ensurePrivateDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Cron storage directory is unsafe.');
  await fs.chmod(directory, 0o700).catch(() => undefined);
}
