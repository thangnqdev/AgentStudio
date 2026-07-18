import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MAX_NOTEBOOK_BYTES } from '../../domain/entities/notebook.js';
import type {
  INotebookDocumentGateway,
  NotebookDocumentRequest,
  NotebookDocumentSnapshot,
} from '../../domain/ports/INotebookDocumentGateway.js';
import { resolveSafeWorkspacePath } from '../security/resolveSafePath.js';
import type { IWorkspaceFileChangeSink } from '../../domain/ports/IWorkspaceFileChangeSink.js';

const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0;
const MAX_OBSERVATIONS = 64;

export class FileSystemNotebookDocumentGateway implements INotebookDocumentGateway {
  private readonly observations = new Map<string, string>();
  private readonly changes?: IWorkspaceFileChangeSink;

  constructor(changes?: IWorkspaceFileChangeSink) { this.changes = changes; }

  async read(input: NotebookDocumentRequest, observe: boolean): Promise<NotebookDocumentSnapshot> {
    const target = await resolveNotebookPath(input);
    const handle = await fs.open(target, constants.O_RDONLY | O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error('Notebook path is not a regular file.');
      if (stat.size > MAX_NOTEBOOK_BYTES) throw new Error(`Notebook exceeds the ${MAX_NOTEBOOK_BYTES}-byte limit.`);
      const content = await handle.readFile('utf8');
      const observedContent = this.observations.get(target);
      if (observe) this.remember(target, content);
      return { path: target, workspaceRoot: input.workspaceRoot, content, mode: stat.mode & 0o777, ...(observedContent !== undefined ? { observedContent } : {}) };
    } finally {
      await handle.close();
    }
  }

  async write(snapshot: NotebookDocumentSnapshot, updatedContent: string) {
    if (Buffer.byteLength(updatedContent, 'utf8') > MAX_NOTEBOOK_BYTES) throw new Error('Updated notebook exceeds the size limit.');
    const current = await readCurrent(snapshot.path);
    if (current !== snapshot.content) throw new Error('Notebook changed before the edit could be saved. Read it again.');
    const temporary = path.join(path.dirname(snapshot.path), `.${path.basename(snapshot.path)}.${randomUUID()}.tmp`);
    const handle = await fs.open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | O_NOFOLLOW, snapshot.mode);
    try {
      await handle.writeFile(updatedContent, 'utf8');
      await handle.close();
      await fs.rename(temporary, snapshot.path);
      this.remember(snapshot.path, updatedContent);
      await this.changes?.fileChanged(snapshot.path, snapshot.workspaceRoot).catch(() => undefined);
    } finally {
      await handle.close().catch(() => undefined);
      await fs.rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  private remember(target: string, content: string) {
    this.observations.delete(target); this.observations.set(target, content);
    while (this.observations.size > MAX_OBSERVATIONS) this.observations.delete(this.observations.keys().next().value!);
  }
}

async function resolveNotebookPath(input: NotebookDocumentRequest) {
  const raw = input.notebookPath;
  if (raw.startsWith('\\\\') || raw.startsWith('//')) throw new Error('UNC notebook paths are not allowed.');
  const target = input.permissionMode === 'danger-full-access' && path.isAbsolute(raw)
    ? path.resolve(raw)
    : await resolveSafeWorkspacePath(raw, input.workspaceRoot);
  if (path.extname(target).toLowerCase() !== '.ipynb') throw new Error('NotebookEdit requires a .ipynb file.');
  const stat = await fs.lstat(target);
  if (stat.isSymbolicLink()) throw new Error('Symbolic links are not allowed for notebooks.');
  return target;
}

async function readCurrent(target: string) {
  const handle = await fs.open(target, constants.O_RDONLY | O_NOFOLLOW);
  try { return await handle.readFile('utf8'); } finally { await handle.close(); }
}
