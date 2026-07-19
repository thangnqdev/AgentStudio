import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemWorkspaceBrowser } from './FileSystemWorkspaceBrowser.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('FileSystemWorkspaceBrowser', () => {
  it('lists directories first and previews a safe text file', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-workspace-browser-'));
    temporaryDirectories.push(root);
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'README.md'), '# AgentStudio');
    const browser = new FileSystemWorkspaceBrowser();

    expect(await browser.list(root, '.')).toEqual([
      { name: 'src', path: 'src', kind: 'directory' },
      { name: 'README.md', path: 'README.md', kind: 'file', size: 13 },
    ]);
    expect(await browser.read(root, 'README.md')).toEqual({ path: 'README.md', content: '# AgentStudio' });
  });

  it('rejects paths that escape the workspace', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-workspace-browser-'));
    temporaryDirectories.push(root);
    const browser = new FileSystemWorkspaceBrowser();

    await expect(browser.list(root, '..')).rejects.toThrow('escapes workspace');
  });
});
