import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_AGENT_TEAM_MEMBERS,
  MAX_AGENT_TEAM_MESSAGES,
  MAX_AGENT_TEAM_SHUTDOWN_REQUESTS,
  type AgentTeamRecord,
} from '../../domain/entities/agentTeam.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

const MAX_FILE_BYTES = 5_000_000;
const MEMBER_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export class PrivateAgentTeamRepository implements IAgentTeamRepository {
  private readonly outputDirectory: string | (() => string);
  private readonly queues = new Map<string, Promise<void>>();

  constructor(outputDirectory: string | (() => string)) {
    this.outputDirectory = outputDirectory;
  }

  create(team: AgentTeamRecord) {
    return this.exclusive(team.scopeId, async () => {
      validateTeam(team, team.scopeId);
      await ensurePrivateDirectory(this.directory());
      if (await exists(this.targetPath(team.scopeId))) throw new Error('An agent team already exists in this scope.');
      await this.write(team);
    });
  }

  async getByScope(scopeId: string) {
    validateId(scopeId, 'Team scope');
    await this.queues.get(scopeId);
    try { return await this.readPath(this.targetPath(scopeId), scopeId); }
    catch (error) { if (missing(error)) return null; throw error; }
  }

  async list() {
    await Promise.all([...this.queues.values()]);
    await ensurePrivateDirectory(this.directory());
    const files = (await fs.readdir(this.directory())).filter((file) => file.endsWith('.json')).slice(0, 500);
    const teams = await Promise.all(files.map(async (file) => {
      try { return await this.readPath(path.join(this.directory(), file)); }
      catch { return null; }
    }));
    return teams.filter((team): team is AgentTeamRecord => team !== null)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  save(team: AgentTeamRecord) {
    return this.exclusive(team.scopeId, async () => {
      validateTeam(team, team.scopeId);
      if (!await exists(this.targetPath(team.scopeId))) throw new Error('Agent team is unavailable.');
      await this.write(team);
    });
  }

  delete(scopeId: string) {
    return this.exclusive(scopeId, async () => {
      validateId(scopeId, 'Team scope');
      await fs.rm(this.targetPath(scopeId), { force: true });
    });
  }

  private async readPath(target: string, expectedScope?: string) {
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE_BYTES) throw new Error('Persisted agent team is unsafe.');
    return validateTeam(JSON.parse(await fs.readFile(target, 'utf8')) as unknown, expectedScope);
  }

  private async write(team: AgentTeamRecord) {
    await ensurePrivateDirectory(this.directory());
    await writePrivateFileAtomic(this.targetPath(team.scopeId), `${JSON.stringify(team, null, 2)}\n`);
  }

  private targetPath(scopeId: string) { return path.join(this.directory(), `${digest(scopeId)}.json`); }
  private directory() { return path.resolve(typeof this.outputDirectory === 'function' ? this.outputDirectory() : this.outputDirectory); }

  private exclusive<T>(scopeId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(scopeId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const settled = result.then(() => undefined, () => undefined);
    this.queues.set(scopeId, settled);
    settled.finally(() => { if (this.queues.get(scopeId) === settled) this.queues.delete(scopeId); });
    return result;
  }
}

function validateTeam(value: unknown, expectedScope?: string): AgentTeamRecord {
  if (!isObject(value) || value.version !== 1 || typeof value.scopeId !== 'string' || (expectedScope && value.scopeId !== expectedScope)) invalid();
  const team = value as unknown as AgentTeamRecord;
  for (const field of ['id', 'scopeId', 'name', 'taskListId', 'leadAgentId', 'leadAgentType'] as const) validateText(team[field], 256);
  validateTimestamp(team.createdAt); validateTimestamp(team.updatedAt);
  if (team.description !== undefined) validateText(team.description, 1_000);
  if (!Array.isArray(team.members) || !Array.isArray(team.mailbox) || !Array.isArray(team.shutdownRequests)) invalid();
  if (team.members.length > MAX_AGENT_TEAM_MEMBERS || team.mailbox.length > MAX_AGENT_TEAM_MESSAGES || team.shutdownRequests.length > MAX_AGENT_TEAM_SHUTDOWN_REQUESTS) invalid();
  const memberNames = new Set<string>();
  for (const member of team.members) {
    if (!isObject(member)) invalid();
    validateText(member.agentId, 256); validateText(member.name, 64); validateTimestamp(member.joinedAt);
    if (!MEMBER_NAME.test(member.name) || memberNames.has(member.name.toLowerCase()) || !['read-only', 'workspace-write', 'danger-full-access'].includes(member.permissionMode)) invalid();
    if (member.workerId !== undefined) validateText(member.workerId, 256);
    if (member.agentType !== undefined) validateText(member.agentType, 100);
    if (member.model !== undefined) validateText(member.model, 100);
    memberNames.add(member.name.toLowerCase());
  }
  if (!team.members.some((member) => member.name === 'team-lead' && member.agentId === team.leadAgentId)) invalid();
  const messageIds = new Set<string>();
  for (const message of team.mailbox) {
    if (!isObject(message)) invalid();
    validateText(message.id, 256); validateText(message.from, 128); validateText(message.to, 128); validateText(message.content, 20_000); validateTimestamp(message.createdAt);
    if (!['message', 'task_assignment', 'shutdown_request', 'shutdown_response', 'plan_approval_response'].includes(message.kind)) invalid();
    if (messageIds.has(message.id)) invalid(); messageIds.add(message.id);
    if (message.summary !== undefined) validateText(message.summary, 160);
    if (message.deliveredAt !== undefined) validateTimestamp(message.deliveredAt);
  }
  const shutdownIds = new Set<string>();
  for (const request of team.shutdownRequests) {
    if (!isObject(request)) invalid();
    validateText(request.id, 256); validateText(request.from, 128); validateText(request.to, 128); validateTimestamp(request.createdAt);
    if (!['pending', 'approved', 'rejected'].includes(request.status)) invalid();
    if (shutdownIds.has(request.id)) invalid(); shutdownIds.add(request.id);
    if (request.reason !== undefined) validateText(request.reason, 1_000);
    if (request.responseReason !== undefined) validateText(request.responseReason, 1_000);
    if (request.respondedAt !== undefined) validateTimestamp(request.respondedAt);
  }
  return structuredClone(team);
}

function invalid(): never { throw new Error('Persisted agent team is invalid.'); }
function validateText(value: unknown, maximum: number) { if (typeof value !== 'string' || !value || value.includes('\0') || value.length > maximum) invalid(); }
function validateTimestamp(value: unknown) { validateText(value, 64); if (!Number.isFinite(Date.parse(value as string))) invalid(); }
function digest(value: string) { validateId(value, 'Team scope'); return createHash('sha256').update(value).digest('hex'); }
function validateId(value: string, label: string) { if (!value || value.length > 256 || value.includes('\0')) throw new Error(`${label} is invalid.`); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function missing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
async function exists(target: string) { try { await fs.lstat(target); return true; } catch (error) { if (missing(error)) return false; throw error; } }
async function ensurePrivateDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Agent team directory is unsafe.');
  await fs.chmod(directory, 0o700).catch(() => undefined);
}
