import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentTeamProtocolMessage } from '../../domain/entities/agentTeamProtocol.js';
import { parseAgentTeamProtocolMessage } from '../../domain/entities/agentTeamProtocolParser.js';
import { compareAgentTeamProtocolDelivery } from '../../domain/entities/agentTeamProtocolPolicy.js';
import type { AgentTeamProtocolClaim, IAgentTeamProtocolStore } from '../../domain/ports/IAgentTeamProtocolStore.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

const STORE_VERSION = 1;
const MAX_FILE_BYTES = 25_000_000;
const MAX_ACTIVE_MESSAGES = 1_000;
const MAX_ACKNOWLEDGED_IDS = 2_000;
const MIN_LEASE_MS = 100;
const MAX_LEASE_MS = 300_000;

type StoredLease = { id: string; owner: string; expiresAt: string };
type StoredMessage = { message: AgentTeamProtocolMessage; sequence: number; lease?: StoredLease };
type StoredProtocol = {
  version: typeof STORE_VERSION;
  teamId: string;
  nextSequence: number;
  messages: StoredMessage[];
  acknowledgedIds: string[];
};

export class PrivateAgentTeamProtocolStore implements IAgentTeamProtocolStore {
  private readonly outputDirectory: string | (() => string);
  private readonly now: () => Date;
  private readonly queues = new Map<string, Promise<void>>();

  constructor(outputDirectory: string | (() => string), now = () => new Date()) {
    this.outputDirectory = outputDirectory;
    this.now = now;
  }

  append(rawMessage: AgentTeamProtocolMessage) {
    const message = parseAgentTeamProtocolMessage(rawMessage);
    return this.exclusive(message.teamId, async () => {
      const store = await this.read(message.teamId);
      if (store.acknowledgedIds.includes(message.id) || store.messages.some((entry) => entry.message.id === message.id)) return false;
      if (store.messages.length >= MAX_ACTIVE_MESSAGES) throw new Error('Agent team protocol mailbox is full.');
      store.messages.push({ message, sequence: store.nextSequence });
      store.nextSequence += 1;
      await this.write(store);
      return true;
    });
  }

  claim(teamId: string, recipient: string, leaseOwner: string, leaseDurationMs = 30_000) {
    validateId(teamId, 'Team ID'); validateId(recipient, 'Recipient'); validateId(leaseOwner, 'Lease owner');
    if (!Number.isInteger(leaseDurationMs) || leaseDurationMs < MIN_LEASE_MS || leaseDurationMs > MAX_LEASE_MS) {
      throw new Error('Agent team protocol lease duration is invalid.');
    }
    return this.exclusive(teamId, async (): Promise<AgentTeamProtocolClaim | null> => {
      const store = await this.read(teamId);
      const now = this.now();
      const recovered = recoverExpiredLeases(store.messages, now);
      const entry = store.messages
        .filter((candidate) => candidate.message.to === recipient && !candidate.lease)
        .sort(compareAgentTeamProtocolDelivery)[0];
      if (!entry) {
        if (recovered) await this.write(store);
        return null;
      }
      const lease = { id: randomUUID(), owner: leaseOwner, expiresAt: new Date(now.getTime() + leaseDurationMs).toISOString() };
      entry.lease = lease;
      await this.write(store);
      return { message: structuredClone(entry.message), leaseId: lease.id, leasedUntil: lease.expiresAt };
    });
  }

  ack(teamId: string, messageId: string, leaseId: string) {
    validateId(teamId, 'Team ID'); validateId(messageId, 'Message ID'); validateId(leaseId, 'Lease ID');
    return this.exclusive(teamId, async () => {
      const store = await this.read(teamId);
      const index = store.messages.findIndex((entry) => entry.message.id === messageId && entry.lease?.id === leaseId);
      if (index < 0) return false;
      const leased = store.messages[index]!;
      if (Date.parse(leased.lease!.expiresAt) <= this.now().getTime()) {
        delete leased.lease;
        await this.write(store);
        return false;
      }
      store.messages.splice(index, 1);
      store.acknowledgedIds.push(messageId);
      store.acknowledgedIds = store.acknowledgedIds.slice(-MAX_ACKNOWLEDGED_IDS);
      await this.write(store);
      return true;
    });
  }

  release(teamId: string, messageId: string, leaseId: string) {
    validateId(teamId, 'Team ID'); validateId(messageId, 'Message ID'); validateId(leaseId, 'Lease ID');
    return this.exclusive(teamId, async () => {
      const store = await this.read(teamId);
      const entry = store.messages.find((candidate) => candidate.message.id === messageId && candidate.lease?.id === leaseId);
      if (!entry) return false;
      delete entry.lease;
      await this.write(store);
      return true;
    });
  }

  private async read(teamId: string): Promise<StoredProtocol> {
    await ensurePrivateDirectory(this.directory());
    const target = this.targetPath(teamId);
    try {
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE_BYTES) unsafe();
      return validateStore(JSON.parse(await fs.readFile(target, 'utf8')) as unknown, teamId);
    } catch (error) {
      if (!missing(error)) throw error;
      return { version: STORE_VERSION, teamId, nextSequence: 0, messages: [], acknowledgedIds: [] };
    }
  }

  private async write(store: StoredProtocol) {
    await ensurePrivateDirectory(this.directory());
    await writePrivateFileAtomic(this.targetPath(store.teamId), `${JSON.stringify(store, null, 2)}\n`);
  }

  private targetPath(teamId: string) { return path.join(this.directory(), `${digest(teamId)}.json`); }
  private directory() { return path.resolve(typeof this.outputDirectory === 'function' ? this.outputDirectory() : this.outputDirectory); }
  private exclusive<T>(teamId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(teamId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const settled = result.then(() => undefined, () => undefined);
    this.queues.set(teamId, settled);
    settled.finally(() => { if (this.queues.get(teamId) === settled) this.queues.delete(teamId); });
    return result;
  }
}

function validateStore(value: unknown, teamId: string): StoredProtocol {
  if (!isObject(value) || value.version !== STORE_VERSION || value.teamId !== teamId || !Number.isSafeInteger(value.nextSequence)) invalid();
  if (!Array.isArray(value.messages) || !Array.isArray(value.acknowledgedIds)) invalid();
  if (value.messages.length > MAX_ACTIVE_MESSAGES || value.acknowledgedIds.length > MAX_ACKNOWLEDGED_IDS) invalid();
  const messageIds = new Set<string>(); let previousSequence = -1;
  const messages = value.messages.map((raw): StoredMessage => {
    if (!isObject(raw) || !Number.isSafeInteger(raw.sequence) || Number(raw.sequence) <= previousSequence) invalid();
    const message = parseAgentTeamProtocolMessage(raw.message); if (message.teamId !== teamId || messageIds.has(message.id)) invalid();
    messageIds.add(message.id); previousSequence = Number(raw.sequence);
    const lease = raw.lease === undefined ? undefined : validateLease(raw.lease);
    if (Object.keys(raw).some((key) => !['message', 'sequence', 'lease'].includes(key))) invalid();
    return { message, sequence: Number(raw.sequence), ...(lease ? { lease } : {}) };
  });
  const acknowledgedIds = value.acknowledgedIds.map((id) => { validateId(id, 'Acknowledged message ID'); if (messageIds.has(id)) invalid(); return id; });
  if (new Set(acknowledgedIds).size !== acknowledgedIds.length || Number(value.nextSequence) <= previousSequence) invalid();
  if (Object.keys(value).some((key) => !['version', 'teamId', 'nextSequence', 'messages', 'acknowledgedIds'].includes(key))) invalid();
  return { version: STORE_VERSION, teamId, nextSequence: Number(value.nextSequence), messages, acknowledgedIds };
}

function validateLease(value: unknown): StoredLease {
  if (!isObject(value) || Object.keys(value).some((key) => !['id', 'owner', 'expiresAt'].includes(key))) invalid();
  validateId(value.id, 'Lease ID'); validateId(value.owner, 'Lease owner');
  if (typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) invalid();
  return { id: value.id as string, owner: value.owner as string, expiresAt: value.expiresAt };
}
function recoverExpiredLeases(messages: StoredMessage[], now: Date) {
  let recovered = false;
  for (const entry of messages) { if (entry.lease && Date.parse(entry.lease.expiresAt) <= now.getTime()) { delete entry.lease; recovered = true; } }
  return recovered;
}
function digest(value: string) { validateId(value, 'Team ID'); return createHash('sha256').update(value).digest('hex'); }
function validateId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value || value.length > 256 || value.includes('\0')) throw new Error(`${label} is invalid.`);
}
function invalid(): never { throw new Error('Persisted agent team protocol store is invalid.'); }
function unsafe(): never { throw new Error('Persisted agent team protocol store is unsafe.'); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function missing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
async function ensurePrivateDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Agent team protocol directory is unsafe.');
  await fs.chmod(directory, 0o700).catch(() => undefined);
}
