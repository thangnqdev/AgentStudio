import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import { normalizeLifecycleHookDocument } from '../../domain/entities/lifecycleHook.js';
import type { ILifecycleHookSource } from '../../domain/ports/ILifecycleHookSource.js';
import { resolveSafeWorkspacePath } from '../security/resolveSafePath.js';

const MAX_HOOK_FILE_BYTES = 128 * 1024;

export class FileSystemLifecycleHookSource implements ILifecycleHookSource {
  async list(workspaceRoot: string) {
    const target = await resolveSafeWorkspacePath('.agentstudio/hooks.json', workspaceRoot, { allowMissingFinalPath: true });
    const pathStat = await fs.lstat(target).catch((error: unknown) => {
      if (isMissingPath(error)) return undefined;
      throw error;
    });
    if (!pathStat) return [];
    if (pathStat.isSymbolicLink()) throw new Error('Lifecycle hook file cannot be a symbolic link.');
    if (!pathStat.isFile()) throw new Error('Lifecycle hook path is not a regular file.');

    const handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_HOOK_FILE_BYTES) throw new Error('Lifecycle hook file is missing or too large.');
      const content = await handle.readFile({ encoding: 'utf8' });
      if (Buffer.byteLength(content, 'utf8') > MAX_HOOK_FILE_BYTES) throw new Error('Lifecycle hook file is too large.');
      return normalizeLifecycleHookDocument(JSON.parse(content));
    } catch (error) {
      throw new Error(`Invalid lifecycle hooks at ${target}: ${readError(error)}`);
    } finally {
      await handle.close();
    }
  }
}

function isMissingPath(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown lifecycle hook error.';
}
