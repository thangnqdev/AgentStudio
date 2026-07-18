import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizePermissionRules, type PermissionRule } from '../../domain/entities/permissionRule.js';
import type { ToolApprovalRequest } from '../../domain/entities/tool.js';
import type { IUserPermissionRuleWriter } from '../../domain/ports/IUserPermissionRuleWriter.js';

const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0;
const MAX_RULE_FILE_BYTES = 256 * 1024;

export class FileUserPermissionRuleWriter implements IUserPermissionRuleWriter {
  private readonly resolvePath: () => string;

  constructor(resolvePath: () => string) { this.resolvePath = resolvePath; }

  async allowDomain(request: ToolApprovalRequest & { domain: string }) {
    const target = this.resolvePath();
    const directory = path.dirname(target);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const directoryStat = await fs.lstat(directory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error('Permission rule directory is unsafe.');
    const existing = await this.readRules(target);
    if (existing.some((rule) => rule.effect === 'allow' && rule.toolGlob === request.toolName && rule.domainGlob === request.domain)) return;
    const next = [...existing, {
      id: `allow-${request.toolName.toLowerCase()}-${request.domain}`,
      effect: 'allow' as const, source: 'user' as const,
      toolGlob: request.toolName, domainGlob: request.domain,
    }];
    if (next.length > 200) throw new Error('Permission rule limit exceeded (200).');
    await this.atomicWrite(target, `${JSON.stringify(next.map(toStoredRule), null, 2)}\n`);
  }

  private async readRules(target: string) {
    const stat = await fs.lstat(target).catch((error: unknown) => isMissing(error) ? undefined : Promise.reject(error));
    if (!stat) return [];
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Permission rule file is unsafe.');
    if (stat.size > MAX_RULE_FILE_BYTES) throw new Error('Permission rule file is too large.');
    const handle = await fs.open(target, constants.O_RDONLY | O_NOFOLLOW);
    try {
      const content = await handle.readFile('utf8');
      return normalizePermissionRules(JSON.parse(content), 'user', ['allow', 'ask', 'deny']);
    } finally { await handle.close(); }
  }

  private async atomicWrite(target: string, content: string) {
    if (Buffer.byteLength(content, 'utf8') > MAX_RULE_FILE_BYTES) throw new Error('Permission rule file is too large.');
    const temporary = path.join(path.dirname(target), `.rules-${randomUUID()}.tmp`);
    const handle = await fs.open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | O_NOFOLLOW, 0o600);
    try {
      await handle.writeFile(content, 'utf8');
      await handle.sync();
      await handle.close();
      await fs.rename(temporary, target);
      await fs.chmod(target, 0o600);
    } finally {
      await handle.close().catch(() => undefined);
      await fs.rm(temporary, { force: true }).catch(() => undefined);
    }
  }
}

function toStoredRule(rule: PermissionRule) {
  const { source: _source, ...stored } = rule;
  return stored;
}

function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
