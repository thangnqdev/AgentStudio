import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolResult, PermissionMode } from '../../domain/entities/agent.js';
import { resolveSafePath } from '../security/resolveSafePath.js';

import { MAX_FILE_BYTES } from '../../domain/entities/limits.js';

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function resolvePath(inputPath: string, workspaceRoot: string, permissionMode: PermissionMode): string {
  if (permissionMode === 'danger-full-access' && path.isAbsolute(inputPath)) {
    return path.resolve(inputPath);
  }

  // Với read-only hoặc workspace-write, luôn ép đường dẫn phải nằm trong workspace
  return resolveSafePath(inputPath, workspaceRoot);
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
    const dir = resolvePath(getString(args.dir) || '.', workspaceRoot, permissionMode);
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
    const filePath = resolvePath(getString(args.path), workspaceRoot, permissionMode);
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

    const filePath = resolvePath(getString(args.path), workspaceRoot, permissionMode);
    const content = getString(args.content);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    return {
      ok: true,
      output: `Wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${path.relative(workspaceRoot, filePath) || filePath}.`,
    };
  }
}
