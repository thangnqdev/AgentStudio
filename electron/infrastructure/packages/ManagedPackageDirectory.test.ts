import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ManagedPackageDirectory } from './ManagedPackageDirectory.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('ManagedPackageDirectory', () => {
  it('copies and removes only an app-managed package directory', async () => {
    const temporaryRoot = await createTemporaryRoot();
    const source = path.join(temporaryRoot, 'source');
    const managedRoot = path.join(temporaryRoot, 'managed');
    await fs.mkdir(path.join(source, 'nested'), { recursive: true });
    await fs.writeFile(path.join(source, 'nested', 'manifest.json'), '{"name":"review-pack"}');
    const packages = new ManagedPackageDirectory(managedRoot);

    await packages.install(source, 'review-pack');
    const installed = path.join(managedRoot, 'review-pack');

    expect(await fs.readFile(path.join(installed, 'nested', 'manifest.json'), 'utf8')).toBe('{"name":"review-pack"}');
    expect(await packages.owns(installed)).toBe(true);
    expect(await packages.owns(source)).toBe(false);

    await packages.remove(installed);
    await expect(fs.access(installed)).rejects.toThrow();
  });

  it('rejects a package name that escapes the managed root', async () => {
    const temporaryRoot = await createTemporaryRoot();
    const source = path.join(temporaryRoot, 'source');
    await fs.mkdir(source);
    const packages = new ManagedPackageDirectory(path.join(temporaryRoot, 'managed'));

    await expect(packages.install(source, '../outside')).rejects.toThrow('không thuộc vùng ứng dụng quản lý');
  });
});

async function createTemporaryRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-managed-package-'));
  temporaryDirectories.push(root);
  return root;
}
