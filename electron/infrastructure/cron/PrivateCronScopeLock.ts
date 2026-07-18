import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';

const DEFAULT_TIMEOUT_MS = 5_000;
const STALE_AFTER_MS = 120_000;
const POLL_INTERVAL_MS = 25;

export async function acquirePrivateCronScopeLock(target: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const token = randomUUID();
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const handle = await fs.open(target, 'wx', 0o600);
      try {
        await handle.writeFile(token, 'utf8');
      } catch (error) {
        await handle.close().catch(() => undefined);
        await fs.rm(target, { force: true }).catch(() => undefined);
        throw error;
      }
      return async () => {
        await handle.close().catch(() => undefined);
        const current = await fs.readFile(target, 'utf8').catch(() => '');
        if (current === token) await fs.rm(target, { force: true }).catch(() => undefined);
      };
    } catch (error) {
      if (!isExists(error)) throw error;
      await removeUnsafeOrStaleLock(target);
      if (Date.now() >= deadline) throw new Error('Timed out waiting for the cron scope lock.');
      await wait(POLL_INTERVAL_MS);
    }
  }
}

async function removeUnsafeOrStaleLock(target: string) {
  const stat = await fs.lstat(target).catch((error: unknown) => isMissing(error) ? undefined : Promise.reject(error));
  if (!stat) return;
  if (stat.isSymbolicLink() || !stat.isFile() || Date.now() - stat.mtimeMs >= STALE_AFTER_MS) {
    await fs.rm(target, { force: true, recursive: stat.isDirectory() });
  }
}

function wait(milliseconds: number) { return new Promise<void>((resolve) => setTimeout(resolve, milliseconds)); }
function isExists(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'EEXIST'; }
function isMissing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
