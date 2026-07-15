import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentWorktreeSession } from '../../domain/entities/agentWorktree.js';
import type { IAgentWorktreeSessionRepository } from '../../domain/ports/IAgentWorktreeSessionRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

export class PrivateAgentWorktreeSessionRepository implements IAgentWorktreeSessionRepository {
  private readonly outputDirectory: string | (() => string);

  constructor(outputDirectory: string | (() => string)) {
    this.outputDirectory = outputDirectory;
  }

  async load(scopeId: string) {
    validateScopeId(scopeId);
    const target = this.filePath(scopeId);
    try {
      await ensurePrivateDirectory(this.directory());
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32_000) throw new Error('Persisted worktree session is unsafe.');
      return parseSession(JSON.parse(await fs.readFile(target, 'utf8')), scopeId);
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async save(session: AgentWorktreeSession) {
    parseSession(session, session.scopeId);
    await ensurePrivateDirectory(this.directory());
    await writePrivateFileAtomic(this.filePath(session.scopeId), JSON.stringify(session));
  }

  async remove(scopeId: string) {
    validateScopeId(scopeId);
    await ensurePrivateDirectory(this.directory());
    await fs.rm(this.filePath(scopeId), { force: true });
  }

  private filePath(scopeId: string) {
    const digest = createHash('sha256').update(scopeId).digest('hex');
    return path.join(this.directory(), `${digest}.json`);
  }

  private directory() {
    const directory = typeof this.outputDirectory === 'function' ? this.outputDirectory() : this.outputDirectory;
    if (!directory) throw new Error('Worktree session directory is unavailable.');
    return directory;
  }
}

function parseSession(value: unknown, expectedScopeId: string): AgentWorktreeSession {
  if (!isObject(value) || value.scopeId !== expectedScopeId) throw new Error('Persisted worktree session is invalid.');
  const required: Array<keyof AgentWorktreeSession> = [
    'scopeId', 'originalWorkspaceRoot', 'repositoryCommonDir', 'worktreePath', 'worktreeName',
    'worktreeBranch', 'originalHeadCommit', 'createdAt',
  ];
  if (Object.keys(value).some((key) => !required.includes(key as keyof AgentWorktreeSession))) throw new Error('Persisted worktree session has unexpected fields.');
  for (const field of required) {
    const item = value[field];
    if (typeof item !== 'string' || !item || item.includes('\0') || item.length > 4_096) throw new Error(`Persisted worktree ${field} is invalid.`);
  }
  if (!Number.isFinite(Date.parse(value.createdAt as string))) throw new Error('Persisted worktree timestamp is invalid.');
  return structuredClone(value as AgentWorktreeSession);
}

async function ensurePrivateDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Worktree session directory is unsafe.');
  await fs.chmod(directory, 0o700).catch(() => undefined);
}

function validateScopeId(scopeId: string) {
  if (!scopeId || scopeId.length > 256 || scopeId.includes('\0')) throw new Error('Worktree scope is invalid.');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
