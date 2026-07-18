import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemNotebookDocumentGateway } from './FileSystemNotebookDocumentGateway.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe('FileSystemNotebookDocumentGateway', () => {
  it('records exact read content and performs an atomic compare-and-swap write', async () => {
    const root = await temporaryDirectory();
    const target = path.join(root, 'a.ipynb');
    await fs.writeFile(target, '{"cells":[]}');
    const gateway = new FileSystemNotebookDocumentGateway();
    await gateway.read({ notebookPath: 'a.ipynb', workspaceRoot: root, permissionMode: 'workspace-write' }, true);
    const snapshot = await gateway.read({ notebookPath: 'a.ipynb', workspaceRoot: root, permissionMode: 'workspace-write' }, false);
    expect(snapshot.observedContent).toBe(snapshot.content);
    await gateway.write(snapshot, '{"cells":[1]}');
    expect(await fs.readFile(target, 'utf8')).toBe('{"cells":[1]}');
  });

  it('rejects a stale snapshot instead of overwriting an external edit', async () => {
    const root = await temporaryDirectory();
    const target = path.join(root, 'a.ipynb');
    await fs.writeFile(target, 'first');
    const gateway = new FileSystemNotebookDocumentGateway();
    const snapshot = await gateway.read({ notebookPath: 'a.ipynb', workspaceRoot: root, permissionMode: 'workspace-write' }, true);
    await fs.writeFile(target, 'external');
    await expect(gateway.write(snapshot, 'agent')).rejects.toThrow('changed');
    expect(await fs.readFile(target, 'utf8')).toBe('external');
  });

  it.runIf(process.platform !== 'win32')('rejects symlinked notebooks', async () => {
    const root = await temporaryDirectory();
    const outside = path.join(root, 'outside.ipynb');
    await fs.writeFile(outside, '{}');
    await fs.symlink(outside, path.join(root, 'linked.ipynb'));
    await expect(new FileSystemNotebookDocumentGateway().read({
      notebookPath: 'linked.ipynb', workspaceRoot: root, permissionMode: 'workspace-write',
    }, true)).rejects.toThrow('Symbolic links');
  });
});

async function temporaryDirectory() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-notebook-'));
  roots.push(root); return root;
}
