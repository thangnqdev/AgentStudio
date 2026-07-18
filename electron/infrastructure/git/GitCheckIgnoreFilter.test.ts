import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { GitCheckIgnoreFilter } from './GitCheckIgnoreFilter.js';

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((item) => fs.rm(item, { recursive: true, force: true }))));

describe('GitCheckIgnoreFilter', () => {
  it('uses NUL-delimited stdin and returns only ignored workspace paths', async () => {
    const root = await repository();
    await fs.writeFile(path.join(root, '.gitignore'), 'generated/\n--help\n*.generated.ts\n');
    const absoluteIgnored = path.join(root, 'generated', 'absolute.ts');
    const filter = new GitCheckIgnoreFilter();

    const ignored = await filter.findIgnoredPaths([
      'generated/types.ts',
      'src/main.generated.ts',
      '--help',
      absoluteIgnored,
      'src/main.ts',
      '../outside.generated.ts',
    ], root);

    expect([...ignored]).toEqual([
      'generated/types.ts',
      'src/main.generated.ts',
      '--help',
      absoluteIgnored,
    ]);
  });

  it('fails open outside a git repository and propagates cancellation', async () => {
    const root = await temporaryDirectory();
    const filter = new GitCheckIgnoreFilter();
    await expect(filter.findIgnoredPaths(['generated/file.ts'], root)).resolves.toEqual(new Set());
    const controller = new AbortController();
    controller.abort();
    await expect(filter.findIgnoredPaths(['generated/file.ts'], root, controller.signal)).rejects.toThrow('cancelled');
  });
});

async function repository() {
  const root = await temporaryDirectory();
  await execFileAsync('git', ['init', '--quiet'], { cwd: root });
  return root;
}

async function temporaryDirectory() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-gitignore-'));
  temporaryDirectories.push(root);
  return root;
}
