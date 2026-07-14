import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemProjectInstructionLoader } from './FileSystemProjectInstructionLoader.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

async function createWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-instructions-'));
  directories.push(root);
  return root;
}

describe('FileSystemProjectInstructionLoader', () => {
  it('loads recognized root and .claude instruction files in deterministic order', async () => {
    const root = await createWorkspace();
    await fs.mkdir(path.join(root, '.claude'));
    await fs.writeFile(path.join(root, 'AGENTS.md'), 'Agent rules');
    await fs.writeFile(path.join(root, 'CLAUDE.md'), 'Claude rules');
    await fs.writeFile(path.join(root, '.claude', 'CLAUDE.local.md'), 'Local rules');
    await fs.writeFile(path.join(root, 'README.md'), 'Not instructions');

    await expect(new FileSystemProjectInstructionLoader().load(root)).resolves.toEqual([
      { source: 'AGENTS.md', content: 'Agent rules' },
      { source: 'CLAUDE.md', content: 'Claude rules' },
      { source: '.claude/CLAUDE.local.md', content: 'Local rules' },
    ]);
  });

  it('does not follow an instruction symlink outside the workspace', async () => {
    const root = await createWorkspace();
    const outside = await createWorkspace();
    await fs.writeFile(path.join(outside, 'outside.md'), 'outside secret');
    try { await fs.symlink(path.join(outside, 'outside.md'), path.join(root, 'AGENTS.md')); } catch { return; }
    await expect(new FileSystemProjectInstructionLoader().load(root)).rejects.toThrow('Symbolic links');
  });

  it('ignores oversized instruction files', async () => {
    const root = await createWorkspace();
    await fs.writeFile(path.join(root, 'AGENTS.md'), 'x'.repeat(64_001));
    await expect(new FileSystemProjectInstructionLoader().load(root)).resolves.toEqual([]);
  });
});
