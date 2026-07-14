import fs from 'node:fs/promises';
import path from 'node:path';
import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import { MAX_FILE_BYTES } from '../../domain/entities/limits.js';
import { resolveSafeWorkspacePath } from '../security/resolveSafePath.js';

const MAX_SCANNED_FILES = 10_000;
const IGNORED_DIRECTORIES = new Set([
  '.git', 'node_modules', 'dist', 'dist-electron', 'release', 'coverage', '.next', '.cache',
]);

type SearchFile = { absolutePath: string; displayPath: string; matchPath: string; modifiedAt: number };

export class WorkspaceSearchToolExecutor {
  async glob(
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const pattern = readPattern(args.pattern, 'Glob pattern');
    validateGlob(pattern);
    const maxResults = boundedInteger(args.maxResults, 200, 1, 1_000);
    const root = await resolveSearchRoot(readString(args.path) || '.', workspaceRoot, permissionMode);
    const files = await collectFiles(root, workspaceRoot, signal);
    const matches = files.filter((file) => path.posix.matchesGlob(file.matchPath, pattern))
      .sort((left, right) => right.modifiedAt - left.modifiedAt || left.displayPath.localeCompare(right.displayPath));
    return { ok: true, output: formatPaths(matches, maxResults) };
  }

  async grep(
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const pattern = readPattern(args.pattern, 'Search pattern');
    const fileGlob = readString(args.glob) || '**/*';
    validateGlob(fileGlob);
    const matcher = buildMatcher(pattern, args.regex === true, args.caseSensitive === true);
    const maxResults = boundedInteger(args.maxResults, 200, 1, 500);
    const root = await resolveSearchRoot(readString(args.path) || '.', workspaceRoot, permissionMode);
    const files = (await collectFiles(root, workspaceRoot, signal))
      .filter((file) => path.posix.matchesGlob(file.matchPath, fileGlob));
    const results: string[] = [];

    for (const file of files) {
      throwIfStopped(signal);
      const stat = await fs.stat(file.absolutePath);
      if (stat.size > MAX_FILE_BYTES) continue;
      const content = await fs.readFile(file.absolutePath, { encoding: 'utf8', signal });
      if (content.includes('\0')) continue;
      for (const [index, line] of content.split(/\r?\n/).entries()) {
        if (!matcher(line)) continue;
        results.push(`${file.displayPath}:${index + 1}: ${truncateLine(line)}`);
        if (results.length >= maxResults) {
          return { ok: true, output: `${results.join('\n')}\n[results truncated at ${maxResults}]` };
        }
      }
    }
    return { ok: true, output: results.join('\n') || '(no matches)' };
  }
}

async function resolveSearchRoot(inputPath: string, workspaceRoot: string, permissionMode: PermissionMode) {
  if (permissionMode === 'danger-full-access' && path.isAbsolute(inputPath)) return path.resolve(inputPath);
  return resolveSafeWorkspacePath(inputPath, workspaceRoot);
}

async function collectFiles(root: string, workspaceRoot: string, signal?: AbortSignal) {
  const canonicalWorkspaceRoot = await fs.realpath(workspaceRoot).catch(() => path.resolve(workspaceRoot));
  const rootStat = await fs.lstat(root);
  if (rootStat.isSymbolicLink()) throw new Error('Symbolic links are not allowed as search roots.');
  if (rootStat.isFile()) return [describeFile(root, path.dirname(root), canonicalWorkspaceRoot, rootStat.mtimeMs)];
  if (!rootStat.isDirectory()) throw new Error('Search path must be a file or directory.');

  const files: SearchFile[] = [];
  const directories = [root];
  let scannedEntries = 0;
  while (directories.length > 0) {
    throwIfStopped(signal);
    const directory = directories.pop()!;
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      scannedEntries += 1;
      if (files.length >= MAX_SCANNED_FILES || scannedEntries >= MAX_SCANNED_FILES * 5) return files;
      if (entry.isSymbolicLink()) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) directories.push(absolutePath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(absolutePath);
        files.push(describeFile(absolutePath, root, canonicalWorkspaceRoot, stat.mtimeMs));
      }
    }
  }
  return files;
}

function describeFile(absolutePath: string, searchRoot: string, workspaceRoot: string, modifiedAt: number) {
  const workspaceRelative = path.relative(workspaceRoot, absolutePath);
  const displayPath = workspaceRelative && !workspaceRelative.startsWith(`..${path.sep}`) && workspaceRelative !== '..'
    ? workspaceRelative.split(path.sep).join('/')
    : absolutePath;
  return {
    absolutePath,
    displayPath,
    matchPath: path.relative(searchRoot, absolutePath).split(path.sep).join('/') || path.basename(absolutePath),
    modifiedAt,
  } satisfies SearchFile;
}

function buildMatcher(pattern: string, regex: boolean, caseSensitive: boolean) {
  if (!regex) {
    const needle = caseSensitive ? pattern : pattern.toLocaleLowerCase();
    return (line: string) => (caseSensitive ? line : line.toLocaleLowerCase()).includes(needle);
  }
  assertSafeRegex(pattern);
  const expression = new RegExp(pattern, caseSensitive ? '' : 'i');
  return (line: string) => expression.test(line);
}

function assertSafeRegex(pattern: string) {
  if (/\\[1-9]|\(\?<?[=!]|\([^)]*[|+*{][^)]*\)[+*{]|\.\*.*\.\*/.test(pattern)) {
    throw new Error('Regex uses a potentially unsafe construct. Use a simpler expression or literal search.');
  }
  try { new RegExp(pattern); } catch { throw new Error('Search pattern is not a valid regular expression.'); }
}

function validateGlob(pattern: string) {
  if (path.posix.isAbsolute(pattern) || pattern.split('/').includes('..')) throw new Error('Glob must be relative and cannot contain parent traversal.');
  try { path.posix.matchesGlob('validation.txt', pattern); } catch { throw new Error('Glob pattern is invalid.'); }
}

function readPattern(value: unknown, label: string) {
  const pattern = readString(value);
  if (!pattern) throw new Error(`${label} is required.`);
  if (pattern.length > 500) throw new Error(`${label} cannot exceed 500 characters.`);
  return pattern;
}

function readString(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === 'number' && Number.isInteger(value) ? value : fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}
function formatPaths(files: SearchFile[], limit: number) {
  const selected = files.slice(0, limit).map((file) => file.displayPath);
  if (!selected.length) return '(no matches)';
  return files.length > limit ? `${selected.join('\n')}\n[results truncated at ${limit}]` : selected.join('\n');
}
function truncateLine(line: string) { return line.length > 600 ? `${line.slice(0, 600)}…` : line; }
function throwIfStopped(signal?: AbortSignal) { if (signal?.aborted) throw new Error('Search stopped.'); }
