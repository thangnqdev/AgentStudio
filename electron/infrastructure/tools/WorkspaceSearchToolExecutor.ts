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
    const typeGlob = readString(args.typeGlob) || '**/*';
    validateGlob(fileGlob);
    validateGlob(typeGlob);
    const regex = args.regex === true;
    const caseSensitive = args.caseSensitive === true;
    const multiline = args.multiline === true;
    if (regex) assertSafeRegex(pattern);
    const outputMode = readOutputMode(args.outputMode);
    const requestedLimit = boundedInteger(args.maxResults, 200, 0, 500);
    const maxResults = requestedLimit === 0 ? 500 : requestedLimit;
    const offset = boundedInteger(args.offset, 0, 0, 10_000);
    const contextBefore = boundedInteger(args.contextBefore, 0, 0, 100);
    const contextAfter = boundedInteger(args.contextAfter, 0, 0, 100);
    const lineNumbers = args.lineNumbers !== false;
    const root = await resolveSearchRoot(readString(args.path) || '.', workspaceRoot, permissionMode);
    const files = (await collectFiles(root, workspaceRoot, signal))
      .filter((file) => path.posix.matchesGlob(file.matchPath, fileGlob) && path.posix.matchesGlob(file.matchPath, typeGlob));
    const results: string[] = [];

    search:
    for (const file of files) {
      throwIfStopped(signal);
      const stat = await fs.stat(file.absolutePath);
      if (stat.size > MAX_FILE_BYTES) continue;
      const content = await fs.readFile(file.absolutePath, { encoding: 'utf8', signal });
      if (content.includes('\0')) continue;
      const lines = content.split(/\r?\n/);
      const matches = findMatches(content, lines, pattern, regex, caseSensitive, multiline);
      if (!matches.lineIndices.length) continue;
      if (outputMode === 'files_with_matches') results.push(file.displayPath);
      else if (outputMode === 'count') results.push(`${file.displayPath}:${matches.count}`);
      else {
        const selected = new Set<number>();
        for (const index of matches.lineIndices) {
          for (let line = Math.max(0, index - contextBefore); line <= Math.min(lines.length - 1, index + contextAfter); line += 1) selected.add(line);
        }
        for (const index of [...selected].sort((left, right) => left - right)) {
          const prefix = lineNumbers ? `${file.displayPath}:${index + 1}: ` : `${file.displayPath}: `;
          results.push(`${prefix}${truncateLine(lines[index]!)}`);
          if (results.length > offset + maxResults) break search;
        }
      }
      if (results.length > offset + maxResults) break;
    }
    const selected = results.slice(offset, offset + maxResults);
    const truncated = results.length > offset + maxResults || requestedLimit === 0 && results.length > maxResults;
    return { ok: true, output: `${selected.join('\n') || '(no matches)'}${truncated ? `\n[results truncated at ${maxResults}]` : ''}` };
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

function findMatches(content: string, lines: string[], pattern: string, regex: boolean, caseSensitive: boolean, multiline: boolean) {
  if (!multiline) {
    const matcher = buildLineMatcher(pattern, regex, caseSensitive);
    const lineIndices = lines.flatMap((line, index) => matcher(line) ? [index] : []);
    return { count: lineIndices.length, lineIndices };
  }
  const source = regex ? pattern : escapeRegex(pattern);
  const expression = new RegExp(source, `${caseSensitive ? '' : 'i'}gs`);
  const starts = lineStarts(content);
  const selected = new Set<number>();
  let count = 0;
  for (const match of content.matchAll(expression)) {
    const start = match.index;
    const end = start + Math.max(match[0].length - 1, 0);
    const firstLine = lineIndexAt(starts, start);
    const lastLine = lineIndexAt(starts, end);
    for (let line = firstLine; line <= lastLine; line += 1) selected.add(line);
    count += 1;
    if (count >= 10_000) break;
  }
  return { count, lineIndices: [...selected] };
}

function buildLineMatcher(pattern: string, regex: boolean, caseSensitive: boolean) {
  if (!regex) {
    const needle = caseSensitive ? pattern : pattern.toLocaleLowerCase();
    return (line: string) => (caseSensitive ? line : line.toLocaleLowerCase()).includes(needle);
  }
  const expression = new RegExp(pattern, caseSensitive ? '' : 'i');
  return (line: string) => expression.test(line);
}

function lineStarts(content: string) {
  const starts = [0];
  for (let index = 0; index < content.length; index += 1) if (content[index] === '\n') starts.push(index + 1);
  return starts;
}

function lineIndexAt(starts: number[], position: number) {
  let low = 0; let high = starts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle]! <= position) low = middle; else high = middle;
  }
  return low;
}

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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
function readOutputMode(value: unknown) {
  if (value === undefined) return 'content' as const;
  if (value === 'content' || value === 'files_with_matches' || value === 'count') return value;
  throw new Error('Grep output mode is invalid.');
}
function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Search range value must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}
function formatPaths(files: SearchFile[], limit: number) {
  const selected = files.slice(0, limit).map((file) => file.displayPath);
  if (!selected.length) return '(no matches)';
  return files.length > limit ? `${selected.join('\n')}\n[results truncated at ${limit}]` : selected.join('\n');
}
function truncateLine(line: string) { return line.length > 600 ? `${line.slice(0, 600)}…` : line; }
function throwIfStopped(signal?: AbortSignal) { if (signal?.aborted) throw new Error('Search stopped.'); }
