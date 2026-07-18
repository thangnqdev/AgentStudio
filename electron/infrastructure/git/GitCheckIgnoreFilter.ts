import { execFile } from 'node:child_process';
import path from 'node:path';
import type { IWorkspaceIgnoreFilter } from '../../domain/ports/IWorkspaceIgnoreFilter.js';

const CHECK_IGNORE_TIMEOUT_MS = 5_000;
const CHECK_IGNORE_BATCH_SIZE = 500;
const CHECK_IGNORE_MAX_BUFFER_BYTES = 1_000_000;

type Candidate = { query: string; originalPaths: string[] };

export class GitCheckIgnoreFilter implements IWorkspaceIgnoreFilter {
  async findIgnoredPaths(filePaths: string[], workspaceRoot: string, signal?: AbortSignal) {
    const candidates = prepareCandidates(filePaths, workspaceRoot);
    const ignored = new Set<string>();
    for (let index = 0; index < candidates.length; index += CHECK_IGNORE_BATCH_SIZE) {
      if (signal?.aborted) throw new Error('Gitignore filtering cancelled.');
      const batch = candidates.slice(index, index + CHECK_IGNORE_BATCH_SIZE);
      const ignoredQueries = await checkIgnored(batch.map((item) => item.query), workspaceRoot, signal);
      for (const candidate of batch) {
        if (ignoredQueries.has(candidate.query)) candidate.originalPaths.forEach((item) => ignored.add(item));
      }
    }
    return ignored;
  }
}

function prepareCandidates(filePaths: string[], workspaceRoot: string): Candidate[] {
  const root = path.resolve(workspaceRoot);
  const byQuery = new Map<string, string[]>();
  for (const original of filePaths) {
    if (!original || original.includes('\0')) continue;
    const absolute = path.resolve(root, original);
    const relative = path.relative(root, absolute);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue;
    const query = relative.replaceAll('\\', '/');
    byQuery.set(query, [...(byQuery.get(query) ?? []), original]);
  }
  return [...byQuery].map(([query, originalPaths]) => ({ query, originalPaths }));
}

function checkIgnored(paths: string[], workspaceRoot: string, signal?: AbortSignal) {
  if (paths.length === 0) return Promise.resolve(new Set<string>());
  return new Promise<Set<string>>((resolve, reject) => {
    try {
      const child = execFile('git', ['check-ignore', '-z', '--stdin'], {
        cwd: path.resolve(workspaceRoot),
        encoding: 'utf8',
        maxBuffer: CHECK_IGNORE_MAX_BUFFER_BYTES,
        timeout: CHECK_IGNORE_TIMEOUT_MS,
        signal,
        shell: false,
        windowsHide: true,
      }, (error, stdout) => {
        if (signal?.aborted) { reject(new Error('Gitignore filtering cancelled.')); return; }
        if (error) { resolve(new Set()); return; }
        resolve(new Set(stdout.split('\0').filter(Boolean)));
      });
      child.stdin?.on('error', () => undefined);
      child.stdin?.end(`${paths.join('\0')}\0`);
    } catch {
      if (signal?.aborted) reject(new Error('Gitignore filtering cancelled.'));
      else resolve(new Set());
    }
  });
}
