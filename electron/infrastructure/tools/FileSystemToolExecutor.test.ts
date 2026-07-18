import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('notifies the language-service sink only after a successful write', async () => {
    const workspace = await createWorkspace('before');
    const fileChanged = vi.fn(async () => undefined);
    const executor = new FileSystemToolExecutor({ fileChanged });
    await executor.writeFile({ path: 'sample.txt', content: 'after' }, workspace, 'workspace-write');
    expect(fileChanged).toHaveBeenCalledWith(await fs.realpath(path.join(workspace, 'sample.txt')), workspace);
  });

  it('supports bounded one-based line slices for the Read compatibility alias', async () => {
    const workspace = await createWorkspace('one\ntwo\nthree\nfour\n');
    await expect(new FileSystemToolExecutor().readFile(
      { path: 'sample.txt', offset: 2, limit: 2 }, workspace, 'workspace-write',
    )).resolves.toEqual({ ok: true, output: 'two\nthree\n' });
  });

  it('routes supported media through the bounded multimodal reader before the text size cap', async () => {
    const workspace = await createWorkspace('text');
    const imagePath = path.join(workspace, 'diagram.png');
    await fs.writeFile(imagePath, Buffer.alloc(250_000, 1));
    const read = vi.fn(async () => ({
      ok: true, output: 'Image read.', supplementalMessages: [{ role: 'user' as const, content: [] }],
    }));
    const executor = new FileSystemToolExecutor(undefined, { supports: (candidate) => candidate.endsWith('.png'), read });
    await expect(executor.readFile({ path: 'diagram.png' }, workspace, 'workspace-write')).resolves.toMatchObject({
      ok: true, supplementalMessages: [{ role: 'user' }],
    });
    expect(read).toHaveBeenCalledWith(await fs.realpath(imagePath), undefined, undefined);
  });

  it('rejects PDF page ranges for text files', async () => {
    const workspace = await createWorkspace('text');
    await expect(new FileSystemToolExecutor().readFile(
      { path: 'sample.txt', pages: '1-2' }, workspace, 'workspace-write',
    )).resolves.toEqual({ ok: false, output: expect.stringContaining('only supported for PDF') });
  });

  it('replaces every exact occurrence only when replaceAll is explicit', async () => {
    const workspace = await createWorkspace('same\nsame\n');
    const result = await new FileSystemToolExecutor().applyPatch(
      { path: 'sample.txt', oldText: 'same', newText: 'changed', replaceAll: true }, workspace, 'workspace-write',
    );
    expect(result.ok).toBe(true);
    expect(await fs.readFile(path.join(workspace, 'sample.txt'), 'utf8')).toBe('changed\nchanged\n');
  });
});
