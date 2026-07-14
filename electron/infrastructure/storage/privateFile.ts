import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function writePrivateFileAtomic(targetPath: string, content: string | Buffer) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporaryPath, content, { mode: 0o600 });
    await fs.rename(temporaryPath, targetPath);
    await fs.chmod(targetPath, 0o600).catch(() => undefined);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

export async function appendPrivateLine(targetPath: string, line: string) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.appendFile(targetPath, line, { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(targetPath, 0o600).catch(() => undefined);
}
