import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Message, PermissionMode } from '../../domain/entities/agent.js';
import type {
  AgentWorkerCheckpoint,
  AgentWorkerNotification,
  AgentWorkerRecord,
  AgentWorkerStatus,
} from '../../domain/entities/agentWorker.js';
import type { IAgentWorkerRepository } from '../../domain/ports/IAgentWorkerRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

const VERSION = 1;
const MAX_WORKER_FILE_BYTES = 25_000_000;
const MAX_QUEUED_MESSAGES = 100;
const MAX_NOTIFICATIONS = 200;
const WORKER_STATUSES: AgentWorkerStatus[] = ['running', 'paused', 'completed', 'failed', 'killed'];
const PERMISSION_MODES: PermissionMode[] = ['read-only', 'workspace-write', 'danger-full-access'];

type WorkerEnvelope = { version: typeof VERSION; worker: AgentWorkerRecord; queuedMessages: Message[] };
type NotificationEnvelope = { version: typeof VERSION; notifications: AgentWorkerNotification[] };

export class PrivateAgentWorkerRepository implements IAgentWorkerRepository {
  private readonly outputDirectory: string | (() => string);
  private readonly queues = new Map<string, Promise<void>>();

  constructor(outputDirectory: string | (() => string)) {
    this.outputDirectory = outputDirectory;
  }

  create(worker: AgentWorkerRecord) {
    return this.exclusive(`worker:${worker.id}`, async () => {
      validateWorker(worker, worker.id);
      await ensurePrivateDirectory(this.workerDirectory());
      if (await exists(this.workerPath(worker.id))) throw new Error('Agent worker already exists.');
      await this.writeWorker({ version: VERSION, worker: structuredClone(worker), queuedMessages: [] });
    });
  }

  async get(agentId: string) {
    validateId(agentId, 'Agent ID');
    await this.queues.get(`worker:${agentId}`);
    return (await this.readWorker(agentId))?.worker ?? null;
  }

  async list(parentScopeId: string) {
    validateId(parentScopeId, 'Agent parent scope');
    await Promise.all([...this.queues.values()]);
    await ensurePrivateDirectory(this.workerDirectory());
    const files = (await fs.readdir(this.workerDirectory())).filter((file) => file.endsWith('.json')).slice(0, 500);
    const workers = await Promise.all(files.map(async (file) => {
      try { return (await this.readEnvelopePath(path.join(this.workerDirectory(), file))).worker; }
      catch { return null; }
    }));
    return workers.filter((worker): worker is AgentWorkerRecord => worker?.parentScopeId === parentScopeId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  saveCheckpoint(checkpoint: AgentWorkerCheckpoint) {
    return this.exclusive(`worker:${checkpoint.id}`, async () => {
      const envelope = await this.requireWorker(checkpoint.id);
      const worker = { ...envelope.worker, ...structuredClone(checkpoint) };
      validateWorker(worker, checkpoint.id);
      await this.writeWorker({ ...envelope, worker });
    });
  }

  enqueueMessage(agentId: string, message: Message) {
    return this.exclusive(`worker:${agentId}`, async () => {
      validateMessage(message);
      const envelope = await this.requireWorker(agentId);
      if (envelope.queuedMessages.length >= MAX_QUEUED_MESSAGES) throw new Error('Agent message queue is full.');
      envelope.queuedMessages.push(structuredClone(message));
      await this.writeWorker(envelope);
    });
  }

  drainMessages(agentId: string) {
    return this.exclusive(`worker:${agentId}`, async () => {
      const envelope = await this.requireWorker(agentId);
      const messages = structuredClone(envelope.queuedMessages);
      if (messages.length) await this.writeWorker({ ...envelope, queuedMessages: [] });
      return messages;
    });
  }

  addNotification(notification: AgentWorkerNotification) {
    return this.exclusive(`notifications:${notification.parentScopeId}`, async () => {
      validateNotification(notification, notification.parentScopeId);
      const envelope = await this.readNotifications(notification.parentScopeId);
      envelope.notifications.push(structuredClone(notification));
      envelope.notifications = envelope.notifications.slice(-MAX_NOTIFICATIONS);
      await this.writeNotifications(notification.parentScopeId, envelope);
    });
  }

  drainNotifications(parentScopeId: string) {
    return this.exclusive(`notifications:${parentScopeId}`, async () => {
      const envelope = await this.readNotifications(parentScopeId);
      const notifications = structuredClone(envelope.notifications);
      if (notifications.length) await this.writeNotifications(parentScopeId, { version: VERSION, notifications: [] });
      return notifications;
    });
  }

  async recoverInterrupted() {
    await ensurePrivateDirectory(this.workerDirectory());
    const files = (await fs.readdir(this.workerDirectory())).filter((file) => file.endsWith('.json')).slice(0, 500);
    const recovered: AgentWorkerRecord[] = [];
    for (const file of files) {
      let envelope: WorkerEnvelope;
      try { envelope = await this.readEnvelopePath(path.join(this.workerDirectory(), file)); }
      catch { continue; }
      if (envelope.worker.status !== 'running') continue;
      const worker: AgentWorkerRecord = {
        ...envelope.worker, status: 'paused', updatedAt: new Date().toISOString(),
        error: 'Application closed before this agent completed.',
      };
      await this.saveCheckpoint(worker);
      recovered.push(worker);
    }
    return recovered;
  }

  private async requireWorker(agentId: string) {
    const envelope = await this.readWorker(agentId);
    if (!envelope) throw new Error('Agent worker transcript is unavailable.');
    return envelope;
  }

  private async readWorker(agentId: string) {
    validateId(agentId, 'Agent ID');
    try { return await this.readEnvelopePath(this.workerPath(agentId), agentId); }
    catch (error) { if (missing(error)) return null; throw error; }
  }

  private async readEnvelopePath(target: string, expectedId?: string) {
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_WORKER_FILE_BYTES) throw new Error('Persisted agent worker is unsafe.');
    const value = JSON.parse(await fs.readFile(target, 'utf8')) as unknown;
    if (!isObject(value) || value.version !== VERSION || !Array.isArray(value.queuedMessages)) throw new Error('Persisted agent worker is invalid.');
    const worker = validateWorker(value.worker, expectedId);
    const queuedMessages = value.queuedMessages.map(validateMessage);
    if (queuedMessages.length > MAX_QUEUED_MESSAGES) throw new Error('Persisted agent message queue is invalid.');
    return { version: VERSION, worker, queuedMessages } satisfies WorkerEnvelope;
  }

  private async writeWorker(envelope: WorkerEnvelope) {
    await ensurePrivateDirectory(this.workerDirectory());
    await writePrivateFileAtomic(this.workerPath(envelope.worker.id), JSON.stringify(envelope));
  }

  private async readNotifications(scopeId: string): Promise<NotificationEnvelope> {
    validateId(scopeId, 'Agent parent scope');
    const target = this.notificationPath(scopeId);
    try {
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2_000_000) throw new Error('Persisted agent notifications are unsafe.');
      const value = JSON.parse(await fs.readFile(target, 'utf8')) as unknown;
      if (!isObject(value) || value.version !== VERSION || !Array.isArray(value.notifications)) throw new Error('Persisted agent notifications are invalid.');
      return { version: VERSION, notifications: value.notifications.map((item) => validateNotification(item, scopeId)).slice(-MAX_NOTIFICATIONS) };
    } catch (error) {
      if (missing(error)) return { version: VERSION, notifications: [] };
      throw error;
    }
  }

  private async writeNotifications(scopeId: string, envelope: NotificationEnvelope) {
    await ensurePrivateDirectory(this.notificationDirectory());
    await writePrivateFileAtomic(this.notificationPath(scopeId), JSON.stringify(envelope));
  }

  private workerPath(agentId: string) { return path.join(this.workerDirectory(), `${digest(agentId)}.json`); }
  private notificationPath(scopeId: string) { return path.join(this.notificationDirectory(), `${digest(scopeId)}.json`); }
  private workerDirectory() { return path.join(this.directory(), 'workers'); }
  private notificationDirectory() { return path.join(this.directory(), 'notifications'); }
  private directory() { return path.resolve(typeof this.outputDirectory === 'function' ? this.outputDirectory() : this.outputDirectory); }

  private exclusive<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const settled = result.then(() => undefined, () => undefined);
    this.queues.set(key, settled);
    settled.finally(() => { if (this.queues.get(key) === settled) this.queues.delete(key); });
    return result;
  }
}

function validateWorker(value: unknown, expectedId?: string): AgentWorkerRecord {
  if (!isObject(value) || typeof value.id !== 'string' || (expectedId && value.id !== expectedId)) throw new Error('Persisted agent worker is invalid.');
  for (const field of ['traceId', 'parentScopeId', 'description', 'prompt', 'workspaceRoot', 'createdAt', 'updatedAt'] as const) validateText(value[field], field, 40_000);
  if (!WORKER_STATUSES.includes(value.status as AgentWorkerStatus) || !PERMISSION_MODES.includes(value.permissionMode as PermissionMode)) throw new Error('Persisted agent worker state is invalid.');
  if (!Number.isInteger(value.depth) || !Number.isInteger(value.completedSteps) || !Array.isArray(value.messages) || !Array.isArray(value.conversation)) throw new Error('Persisted agent worker progress is invalid.');
  value.messages.forEach(validateMessage);
  return structuredClone(value as AgentWorkerRecord);
}

function validateMessage(value: unknown): Message {
  if (!isObject(value) || typeof value.id !== 'string' || !['user', 'agent', 'system'].includes(String(value.sender)) || typeof value.content !== 'string' || value.content.length > 100_000) throw new Error('Persisted agent message is invalid.');
  return structuredClone(value as Message);
}

function validateNotification(value: unknown, scopeId: string): AgentWorkerNotification {
  if (!isObject(value) || value.parentScopeId !== scopeId || typeof value.id !== 'string' || typeof value.agentId !== 'string' || typeof value.message !== 'string' || value.message.length > 50_000 || !['completed', 'paused', 'failed', 'killed'].includes(String(value.status))) throw new Error('Persisted agent notification is invalid.');
  return structuredClone(value as AgentWorkerNotification);
}

function validateText(value: unknown, field: string, maximum: number) {
  if (typeof value !== 'string' || !value || value.includes('\0') || value.length > maximum) throw new Error(`Persisted agent worker ${field} is invalid.`);
}

async function ensurePrivateDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Agent worker directory is unsafe.');
  await fs.chmod(directory, 0o700).catch(() => undefined);
}

function digest(value: string) { validateId(value, 'Agent identifier'); return createHash('sha256').update(value).digest('hex'); }
function validateId(value: string, label: string) { if (!value || value.length > 256 || value.includes('\0')) throw new Error(`${label} is invalid.`); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function missing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
async function exists(target: string) { try { await fs.lstat(target); return true; } catch (error) { if (missing(error)) return false; throw error; } }
