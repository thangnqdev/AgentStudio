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
});
