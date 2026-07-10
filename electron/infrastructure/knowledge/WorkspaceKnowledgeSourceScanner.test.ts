import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceKnowledgeSourceScanner } from './WorkspaceKnowledgeSourceScanner.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { force: true, recursive: true })));
});

describe('WorkspaceKnowledgeSourceScanner', () => {
  it('scans allowed sources and skips generated or sensitive files', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-kb-'));
    temporaryDirectories.push(workspace);
    await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'node_modules', 'pkg'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'src', 'booking.ts'), 'export const booking = true;');
    await fs.writeFile(path.join(workspace, 'README.md'), '# Read me');
    await fs.writeFile(path.join(workspace, '.env.local'), 'SECRET=value');
    await fs.writeFile(path.join(workspace, 'node_modules', 'pkg', 'index.js'), 'module.exports = {};');

    const result = await new WorkspaceKnowledgeSourceScanner().scan(workspace);
    const relativeSources = result.sourcePaths.map((source) => path.relative(workspace, source)).sort();

    expect(relativeSources).toEqual(['README.md', path.join('src', 'booking.ts')]);
    expect(result.truncated).toBe(false);
  });
});
