import fs from 'node:fs/promises';
import path from 'node:path';
import type { WorkspaceFileContent, WorkspaceFileEntry } from '../../domain/entities/workspaceFile.js';
import type { IWorkspaceFileBrowser } from '../../domain/ports/IWorkspaceFileBrowser.js';
import { MAX_FILE_BYTES } from '../../domain/entities/limits.js';
import { resolveSafeWorkspacePath } from '../security/resolveSafePath.js';

const HIDDEN_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'dist-electron']);

export class FileSystemWorkspaceBrowser implements IWorkspaceFileBrowser {
  async list(workspaceRoot: string, relativeDirectory: string): Promise<WorkspaceFileEntry[]> {
    const realWorkspaceRoot = await fs.realpath(workspaceRoot);
    const directory = await resolveSafeWorkspacePath(relativeDirectory || '.', workspaceRoot);
    const stat = await fs.stat(directory);
    if (!stat.isDirectory()) throw new Error('Workspace path is not a directory.');

    const entries = await fs.readdir(directory, { withFileTypes: true });
    const visible = entries.filter((entry) => !HIDDEN_DIRECTORIES.has(entry.name));
    const withMetadata = await Promise.all(visible.slice(0, 300).map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(realWorkspaceRoot, absolutePath).split(path.sep).join('/');
      if (entry.isDirectory()) {
        return { name: entry.name, path: relativePath, kind: 'directory' as const };
      }
      const fileStat = await fs.stat(absolutePath);
      return { name: entry.name, path: relativePath, kind: 'file' as const, size: fileStat.size };
    }));

    return withMetadata.sort((left, right) => (
      left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind === 'directory' ? -1 : 1
    ));
  }

  async read(workspaceRoot: string, relativePath: string): Promise<WorkspaceFileContent> {
    const filePath = await resolveSafeWorkspacePath(relativePath, workspaceRoot);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error('Workspace path is not a file.');
    if (stat.size > MAX_FILE_BYTES) throw new Error(`File exceeds the ${MAX_FILE_BYTES}-byte preview limit.`);

    const content = await fs.readFile(filePath, 'utf8');
    if (content.includes('\0')) throw new Error('Binary files cannot be previewed.');
    return { path: relativePath, content };
  }
}
