import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import { normalizePermissionRules, type PermissionRuleEffect, type PermissionRuleSource } from '../../domain/entities/permissionRule.js';
import type { IPermissionRuleSource } from '../../domain/ports/IPermissionRuleSource.js';

const MAX_RULE_FILE_BYTES = 256 * 1024;

export type FilePermissionRuleSourceOptions = {
  source: PermissionRuleSource;
  allowedEffects: readonly PermissionRuleEffect[];
  resolvePath: (workspaceRoot: string) => string | Promise<string>;
};

export class FilePermissionRuleSource implements IPermissionRuleSource {
  private readonly options: FilePermissionRuleSourceOptions;

  constructor(options: FilePermissionRuleSourceOptions) {
    this.options = options;
  }

  async list(workspaceRoot: string) {
    const target = await this.options.resolvePath(workspaceRoot);
    const pathStat = await fs.lstat(target).catch((error: unknown) => {
      if (isMissingPath(error)) return undefined;
      throw error;
    });
    if (!pathStat) return [];
    if (pathStat.isSymbolicLink()) throw new Error(`Permission rule file cannot be a symbolic link: ${target}`);
    if (!pathStat.isFile()) throw new Error(`Permission rule path is not a regular file: ${target}`);

    const handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error(`Permission rule path is not a regular file: ${target}`);
      if (stat.size > MAX_RULE_FILE_BYTES) throw new Error(`Permission rule file exceeds ${MAX_RULE_FILE_BYTES} bytes.`);
      const contents = await handle.readFile({ encoding: 'utf8' });
      if (Buffer.byteLength(contents, 'utf8') > MAX_RULE_FILE_BYTES) throw new Error(`Permission rule file exceeds ${MAX_RULE_FILE_BYTES} bytes.`);
      return normalizePermissionRules(JSON.parse(contents), this.options.source, this.options.allowedEffects);
    } catch (error) {
      throw new Error(`Invalid permission rules at ${target}: ${readError(error)}`);
    } finally {
      await handle.close();
    }
  }
}

function isMissingPath(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown permission rule error.';
}
