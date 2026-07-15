import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentWorktreeSession } from '../../domain/entities/agentWorktree.js';
import type { IAgentWorktreeGateway } from '../../domain/ports/IAgentWorktreeGateway.js';
import { isInsidePath } from '../security/resolveSafePath.js';
import { buildSafeProcessEnvironment } from '../tools/sandbox/ProcessTree.js';

type GitResult = { code: number; stdout: string; stderr: string };
type GitRunner = (args: string[], cwd: string) => Promise<GitResult>;

export class GitAgentWorktreeGateway implements IAgentWorktreeGateway {
  private readonly outputRoot: string | (() => string);
  private readonly runGit: GitRunner;

  constructor(outputRoot: string | (() => string), runGit: GitRunner = executeGit) {
    this.outputRoot = outputRoot;
    this.runGit = runGit;
  }

  async create(scopeId: string, workspaceRoot: string, name: string): Promise<AgentWorktreeSession> {
    const repository = await this.resolveRepository(workspaceRoot);
    const directory = await this.prepareRepositoryDirectory(repository.commonDir);
    const flatName = name.replaceAll('/', '+');
    const managedName = `${flatName}-${createHash('sha256').update(scopeId).digest('hex').slice(0, 10)}`;
    const worktreePath = path.join(directory, managedName);
    const worktreeBranch = `agentstudio-worktree-${managedName}`;
    const existing = await fs.lstat(worktreePath).catch(() => null);
    if (existing) return this.resumeExisting(scopeId, workspaceRoot, repository.commonDir, worktreePath, name, worktreeBranch, existing);

    const branchExists = await this.runGit(['show-ref', '--verify', '--quiet', `refs/heads/${worktreeBranch}`], repository.mainRoot);
    if (branchExists.code === 0) throw new Error(`Worktree branch ${worktreeBranch} already exists without its managed directory. Choose another name or remove the branch manually.`);
    const head = await this.requiredGit(['rev-parse', 'HEAD'], repository.mainRoot, 'resolve the current HEAD');
    const created = await this.runGit(['worktree', 'add', '-b', worktreeBranch, worktreePath, head], repository.mainRoot);
    if (created.code !== 0) {
      await this.runGit(['worktree', 'remove', '--force', worktreePath], repository.mainRoot).catch(() => undefined);
      throw new Error(`Failed to create Git worktree: ${cleanError(created.stderr)}`);
    }
    const session = makeSession(scopeId, workspaceRoot, repository.commonDir, worktreePath, name, worktreeBranch, head);
    if (!(await this.verify(session))) {
      await this.runGit(['worktree', 'remove', '--force', worktreePath], repository.mainRoot).catch(() => undefined);
      await this.runGit(['branch', '-D', worktreeBranch], repository.mainRoot).catch(() => undefined);
      throw new Error('Git created a worktree that failed ownership verification; it was rolled back.');
    }
    return session;
  }

  async verify(session: AgentWorktreeSession) {
    try {
      const outputRoot = await fs.realpath(this.directory());
      const worktreeStat = await fs.lstat(session.worktreePath);
      if (!worktreeStat.isDirectory() || worktreeStat.isSymbolicLink()) return false;
      const realWorktree = await fs.realpath(session.worktreePath);
      if (!isInsidePath(realWorktree, outputRoot)) return false;
      const repository = await this.resolveRepository(session.originalWorkspaceRoot);
      if (!samePath(repository.commonDir, session.repositoryCommonDir)) return false;
      const topLevel = await this.requiredGit(['rev-parse', '--show-toplevel'], realWorktree, 'verify worktree root');
      const branch = await this.requiredGit(['rev-parse', '--abbrev-ref', 'HEAD'], realWorktree, 'verify worktree branch');
      const commonDir = await this.resolveCommonDir(realWorktree);
      if (!samePath(topLevel, realWorktree) || branch !== session.worktreeBranch || !samePath(commonDir, session.repositoryCommonDir)) return false;
      const registered = await this.runGit(['worktree', 'list', '--porcelain'], repository.mainRoot);
      return registered.code === 0 && parseWorktreePaths(registered.stdout).some((item) => samePath(item, realWorktree));
    } catch {
      return false;
    }
  }

  async inspect(session: AgentWorktreeSession) {
    if (!(await this.verify(session))) return null;
    const status = await this.runGit(['status', '--porcelain=v1'], session.worktreePath);
    const commits = await this.runGit(['rev-list', '--count', `${session.originalHeadCommit}..HEAD`], session.worktreePath);
    const commitCount = Number.parseInt(commits.stdout.trim(), 10);
    if (status.code !== 0 || commits.code !== 0 || !Number.isSafeInteger(commitCount) || commitCount < 0) return null;
    return { changedFiles: status.stdout.split(/\r?\n/).filter((line) => line.trim()).length, commits: commitCount };
  }

  async remove(session: AgentWorktreeSession, force: boolean) {
    if (!(await this.verify(session))) throw new Error('Worktree ownership could not be verified. Refusing to remove it.');
    const repository = await this.resolveRepository(session.originalWorkspaceRoot);
    const args = ['worktree', 'remove', ...(force ? ['--force'] : []), session.worktreePath];
    const removed = await this.runGit(args, repository.mainRoot);
    if (removed.code !== 0) throw new Error(`Failed to remove Git worktree: ${cleanError(removed.stderr)}`);
    const branch = await this.runGit(['branch', '-D', session.worktreeBranch], repository.mainRoot);
    return { branchRemoved: branch.code === 0 };
  }

  private async resumeExisting(
    scopeId: string,
    workspaceRoot: string,
    commonDir: string,
    worktreePath: string,
    name: string,
    branch: string,
    stat: Awaited<ReturnType<typeof fs.lstat>>,
  ) {
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Existing worktree path is unsafe.');
    const head = await this.requiredGit(['rev-parse', 'HEAD'], worktreePath, 'read existing worktree HEAD');
    const session = makeSession(scopeId, workspaceRoot, commonDir, worktreePath, name, branch, head);
    if (!(await this.verify(session))) throw new Error('Existing named worktree does not match the expected repository and branch.');
    return session;
  }

  private async resolveRepository(workspaceRoot: string) {
    const realWorkspace = await fs.realpath(workspaceRoot);
    const listing = await this.runGit(['worktree', 'list', '--porcelain'], realWorkspace);
    if (listing.code !== 0) throw new Error('EnterWorktree requires a non-bare Git repository.');
    const paths = parseWorktreePaths(listing.stdout);
    if (!paths[0]) throw new Error('Git did not report a canonical worktree root.');
    return { mainRoot: await fs.realpath(paths[0]), commonDir: await this.resolveCommonDir(realWorkspace) };
  }

  private async resolveCommonDir(workspaceRoot: string) {
    const raw = await this.requiredGit(['rev-parse', '--git-common-dir'], workspaceRoot, 'resolve Git common directory');
    return fs.realpath(path.resolve(workspaceRoot, raw));
  }

  private async prepareRepositoryDirectory(commonDir: string) {
    const root = this.directory();
    await ensurePrivateDirectory(root);
    const repositoryDirectory = path.join(root, createHash('sha256').update(commonDir).digest('hex').slice(0, 24));
    await ensurePrivateDirectory(repositoryDirectory);
    return repositoryDirectory;
  }

  private async requiredGit(args: string[], cwd: string, operation: string) {
    const result = await this.runGit(args, cwd);
    if (result.code !== 0 || !result.stdout.trim()) throw new Error(`Failed to ${operation}: ${cleanError(result.stderr)}`);
    return result.stdout.trim();
  }

  private directory() {
    const directory = typeof this.outputRoot === 'function' ? this.outputRoot() : this.outputRoot;
    if (!directory) throw new Error('Worktree output directory is unavailable.');
    return path.resolve(directory);
  }
}

function makeSession(scopeId: string, originalWorkspaceRoot: string, repositoryCommonDir: string, worktreePath: string, worktreeName: string, worktreeBranch: string, originalHeadCommit: string): AgentWorktreeSession {
  return { scopeId, originalWorkspaceRoot, repositoryCommonDir, worktreePath, worktreeName, worktreeBranch, originalHeadCommit, createdAt: new Date().toISOString() };
}

function executeGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile('git', args, {
      cwd, encoding: 'utf8', windowsHide: true,
      env: { ...buildSafeProcessEnvironment(), GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '' },
    }, (error, stdout, stderr) => resolve({ code: error ? 1 : 0, stdout: String(stdout), stderr: String(stderr) }));
  });
}

async function ensurePrivateDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Worktree output directory is unsafe.');
  await fs.chmod(directory, 0o700).catch(() => undefined);
}

function parseWorktreePaths(output: string) {
  return output.split(/\r?\n/).flatMap((line) => line.startsWith('worktree ') ? [line.slice('worktree '.length).trim()] : []);
}

function samePath(left: string, right: string) {
  const normalize = (value: string) => process.platform === 'win32' ? path.resolve(value).toLocaleLowerCase() : path.resolve(value);
  return normalize(left) === normalize(right);
}

function cleanError(value: string) {
  return value.trim().slice(0, 1_000) || 'Git command failed.';
}
