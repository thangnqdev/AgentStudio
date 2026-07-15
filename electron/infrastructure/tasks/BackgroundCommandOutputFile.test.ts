import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BackgroundCommandOutputFile } from './BackgroundCommandOutputFile.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

describe('BackgroundCommandOutputFile', () => {
  it('writes a private output file and returns only a bounded tail', async () => {
    const directory = await temporaryDirectory();
    const output = await BackgroundCommandOutputFile.create(directory, 'bg-test');
    output.append('a'.repeat(120_000));
    const tail = await output.readTail(1_000);
    expect(tail).toContain('[earlier background output omitted]');
    expect(tail.endsWith('a'.repeat(1_000))).toBe(true);
    await output.close();
    expect((await fs.stat(output.outputPath)).mode & 0o777).toBe(0o600);
  });

  it('refuses a symlink in place of the output directory', async () => {
    const parent = await temporaryDirectory();
    const target = await temporaryDirectory();
    const link = path.join(parent, 'unsafe');
    try { await fs.symlink(target, link); } catch { return; }
    await expect(BackgroundCommandOutputFile.create(link, 'bg-test')).rejects.toThrow('unsafe');
  });
});

async function temporaryDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-background-output-'));
  directories.push(directory);
  return directory;
}
