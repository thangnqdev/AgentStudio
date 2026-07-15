import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { IAgentPlanRepository } from '../../domain/ports/IAgentPlanRepository.js';

export class PrivateAgentPlanRepository implements IAgentPlanRepository {
  private readonly outputDirectory: string | (() => string);

  constructor(outputDirectory: string | (() => string)) {
    this.outputDirectory = outputDirectory;
  }

  async save(scopeId: string, plan: string) {
    if (!scopeId || scopeId.length > 256 || !plan || plan.length > 50_000) throw new Error('Plan storage input is invalid.');
    const directory = this.directory();
    await ensurePrivateDirectory(directory);
    const scopeHash = createHash('sha256').update(scopeId).digest('hex').slice(0, 20);
    const reference = `plan-${scopeHash}-${randomUUID()}.md`;
    const target = path.join(directory, reference);
    const handle = await fs.open(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
      await handle.writeFile(plan, 'utf8');
      await handle.sync();
    } catch (error) {
      await handle.close().catch(() => undefined);
      await fs.rm(target, { force: true }).catch(() => undefined);
      throw error;
    }
    await handle.close();
    await fs.chmod(target, 0o600).catch(() => undefined);
    return { reference };
  }

  private directory() {
    const directory = typeof this.outputDirectory === 'function' ? this.outputDirectory() : this.outputDirectory;
    if (!directory) throw new Error('Plan output directory is unavailable.');
    return directory;
  }
}

async function ensurePrivateDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Plan output directory is unsafe.');
  await fs.chmod(directory, 0o700).catch(() => undefined);
}
