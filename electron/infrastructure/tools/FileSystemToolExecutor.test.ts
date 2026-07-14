import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemToolExecutor } from './FileSystemToolExecutor.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function createWorkspace(content: string) {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-studio-tools-'));
  temporaryDirectories.push(workspace);
  await fs.writeFile(path.join(workspace, 'sample.txt'), content, 'utf8');
  return workspace;
}

describe('FileSystemToolExecutor.applyPatch', () => {
  it('replaces one exact block without rewriting input content through the tool call', async () => {
    const workspace = await createWorkspace('before\ntarget\nafter\n');
    const result = await new FileSystemToolExecutor().applyPatch(
      { path: 'sample.txt', oldText: 'target', newText: 'replacement' },
      workspace,
      'workspace-write',
    );

    expect(result.ok).toBe(true);
    expect(await fs.readFile(path.join(workspace, 'sample.txt'), 'utf8')).toBe('before\nreplacement\nafter\n');
  });

  it('refuses ambiguous replacements and leaves the file unchanged', async () => {
    const workspace = await createWorkspace('same\nsame\n');
    const result = await new FileSystemToolExecutor().applyPatch(
      { path: 'sample.txt', oldText: 'same', newText: 'changed' },
      workspace,
      'workspace-write',
    );

    expect(result.ok).toBe(false);
    expect(await fs.readFile(path.join(workspace, 'sample.txt'), 'utf8')).toBe('same\nsame\n');
  });

  it('refuses symbolic links that point outside the workspace for read, write and patch', async () => {
    const workspace = await createWorkspace('inside');
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-studio-outside-'));
    temporaryDirectories.push(outside);
    const outsideFile = path.join(outside, 'secret.txt');
    await fs.writeFile(outsideFile, 'outside-secret', 'utf8');
    const link = path.join(workspace, 'escape.txt');
    try {
      await fs.symlink(outsideFile, link);
    } catch {
      return;
    }

    const executor = new FileSystemToolExecutor();
    await expect(executor.readFile({ path: 'escape.txt' }, workspace, 'workspace-write')).rejects.toThrow('Symbolic links');
    await expect(executor.writeFile({ path: 'escape.txt', content: 'changed' }, workspace, 'workspace-write')).rejects.toThrow('Symbolic links');
    await expect(executor.applyPatch({ path: 'escape.txt', oldText: 'outside', newText: 'changed' }, workspace, 'workspace-write')).rejects.toThrow('Symbolic links');
    expect(await fs.readFile(outsideFile, 'utf8')).toBe('outside-secret');
  });

  it('caps complete file writes at the shared file-size limit', async () => {
    const workspace = await createWorkspace('');
    const result = await new FileSystemToolExecutor().writeFile({ path: 'large.txt', content: 'x'.repeat(200_001) }, workspace, 'workspace-write');
    expect(result).toMatchObject({ ok: false, output: expect.stringContaining('Content too large') });
    await expect(fs.access(path.join(workspace, 'large.txt'))).rejects.toThrow();
  });
});
