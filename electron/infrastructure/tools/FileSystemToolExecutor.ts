import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ToolResult, PermissionMode } from '../../domain/entities/agent.js';
import { resolveSafeWorkspacePath } from '../security/resolveSafePath.js';

import { MAX_FILE_BYTES } from '../../domain/entities/limits.js';

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function resolvePath(inputPath: string, workspaceRoot: string, permissionMode: PermissionMode, allowMissingFinalPath = false): Promise<string> {
  if (permissionMode === 'danger-full-access' && path.isAbsolute(inputPath)) {
    return path.resolve(inputPath);
  }

  return resolveSafeWorkspacePath(inputPath, workspaceRoot, { allowMissingFinalPath });
}

async function writeAtomically(filePath: string, content: string, mode = 0o644) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, content, { encoding: 'utf8', mode, flag: 'wx' });
    await fs.rename(temporary, filePath);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

/**
 * Thực thi các tool thao tác file: list_files, read_file, write_file.
 */
export class FileSystemToolExecutor {
  async listFiles(
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
  ): Promise<ToolResult> {
    const dir = await resolvePath(getString(args.dir) || '.', workspaceRoot, permissionMode);
    const maxEntries = Math.min(Math.max(Number(args.maxEntries) || 200, 1), 500);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const visibleEntries = entries
      .filter((entry) => !['node_modules', '.git', 'dist', 'dist-electron'].includes(entry.name))
      .slice(0, maxEntries)
      .map((entry) => `${entry.isDirectory() ? 'dir ' : 'file'} ${entry.name}`)
      .join('\n');

    return { ok: true, output: visibleEntries || '(empty)' };
  }

  async readFile(
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
  ): Promise<ToolResult> {
    const filePath = await resolvePath(getString(args.path), workspaceRoot, permissionMode);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return { ok: false, output: 'Path is not a file.' };
    }
    if (stat.size > MAX_FILE_BYTES) {
      return { ok: false, output: `File too large (${stat.size} bytes). Limit is ${MAX_FILE_BYTES} bytes.` };
    }

    return { ok: true, output: await fs.readFile(filePath, 'utf8') };
  }

  async writeFile(
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
  ): Promise<ToolResult> {
    if (permissionMode === 'read-only') {
      return { ok: false, output: 'write_file is blocked in read-only mode.' };
    }

    const filePath = await resolvePath(getString(args.path), workspaceRoot, permissionMode, true);
    const content = getString(args.content);
    const contentBytes = Buffer.byteLength(content, 'utf8');
    if (contentBytes > MAX_FILE_BYTES) {
      return { ok: false, output: `Content too large (${contentBytes} bytes). Limit is ${MAX_FILE_BYTES} bytes.` };
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    if (permissionMode !== 'danger-full-access' || !path.isAbsolute(getString(args.path))) {
      await resolveSafeWorkspacePath(getString(args.path), workspaceRoot, { allowMissingFinalPath: true });
    }
    const existing = await fs.lstat(filePath).catch(() => null);
    if (existing?.isSymbolicLink()) return { ok: false, output: 'Symbolic links are not allowed in workspace paths.' };
    await writeAtomically(filePath, content, existing ? existing.mode & 0o777 : 0o644);
    return {
      ok: true,
      output: `Wrote ${contentBytes} bytes to ${path.relative(workspaceRoot, filePath) || filePath}.`,
    };
  }

  async applyPatch(
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
  ): Promise<ToolResult> {
    if (permissionMode === 'read-only') {
      return { ok: false, output: 'apply_patch is blocked in read-only mode.' };
    }

    const filePath = await resolvePath(getString(args.path), workspaceRoot, permissionMode);
    const oldText = getString(args.oldText);
    const newText = getString(args.newText);
    if (!oldText) return { ok: false, output: 'oldText is required.' };

    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return { ok: false, output: 'Path is not a file.' };
    if (stat.size > MAX_FILE_BYTES) {
      return { ok: false, output: `File too large (${stat.size} bytes). Limit is ${MAX_FILE_BYTES} bytes.` };
    }

    const content = await fs.readFile(filePath, 'utf8');
    const firstIndex = content.indexOf(oldText);
    if (firstIndex < 0) return { ok: false, output: 'oldText was not found; no changes were written.' };
    if (content.indexOf(oldText, firstIndex + oldText.length) >= 0) {
      return { ok: false, output: 'oldText occurs more than once; provide a more specific block.' };
    }

    const nextContent = `${content.slice(0, firstIndex)}${newText}${content.slice(firstIndex + oldText.length)}`;
    if (Buffer.byteLength(nextContent, 'utf8') > MAX_FILE_BYTES) {
      return { ok: false, output: `Patched file would exceed the ${MAX_FILE_BYTES}-byte limit.` };
    }
    await writeAtomically(filePath, nextContent, stat.mode & 0o777);
    return { ok: true, output: `Patched ${path.relative(workspaceRoot, filePath) || filePath}.` };
  }
}
