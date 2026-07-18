import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PrivateWebFetchBinaryStore } from './PrivateWebFetchBinaryStore.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('PrivateWebFetchBinaryStore', () => {
  it('persists binary bytes below an owner-only private directory', async () => {
    const root = await temporaryDirectory();
    const directory = path.join(root, 'web-fetch-content');
    const stored = await new PrivateWebFetchBinaryStore(() => directory)
      .persist({ body: new Uint8Array([1, 2, 3]), contentType: 'application/pdf' });

    expect(path.dirname(stored.path)).toBe(directory);
    expect(path.extname(stored.path)).toBe('.pdf');
    expect(await fs.readFile(stored.path)).toEqual(Buffer.from([1, 2, 3]));
    if (process.platform !== 'win32') {
      expect((await fs.stat(directory)).mode & 0o777).toBe(0o700);
      expect((await fs.stat(stored.path)).mode & 0o777).toBe(0o600);
    }
  });

  it('uses document container extensions needed by downstream readers', async () => {
    const root = await temporaryDirectory();
    const stored = await new PrivateWebFetchBinaryStore(() => path.join(root, 'web-fetch-content')).persist({
      body: new Uint8Array([1]),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(path.extname(stored.path)).toBe('.docx');
  });

  it('evicts old binaries before exceeding the private byte quota', async () => {
    const root = await temporaryDirectory();
    const directory = path.join(root, 'web-fetch-content');
    const store = new PrivateWebFetchBinaryStore(() => directory, { maxFiles: 10, maxTotalBytes: 3 });
    const first = await store.persist({ body: new Uint8Array([1, 2]), contentType: 'application/pdf' });
    const second = await store.persist({ body: new Uint8Array([3, 4]), contentType: 'application/pdf' });
    await expect(fs.stat(first.path)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(second.path)).toEqual(Buffer.from([3, 4]));
  });

  it('rejects a single binary larger than the configured storage quota', async () => {
    const root = await temporaryDirectory();
    const store = new PrivateWebFetchBinaryStore(() => path.join(root, 'web-fetch-content'), { maxTotalBytes: 1 });
    await expect(store.persist({ body: new Uint8Array([1, 2]), contentType: 'application/pdf' }))
      .rejects.toThrow('storage quota');
  });

  it.runIf(process.platform !== 'win32')('rejects a symlink in place of the private directory', async () => {
    const root = await temporaryDirectory();
    const target = path.join(root, 'target');
    const link = path.join(root, 'web-fetch-content');
    await fs.mkdir(target);
    await fs.symlink(target, link, 'dir');

    await expect(new PrivateWebFetchBinaryStore(() => link)
      .persist({ body: new Uint8Array([1]), contentType: 'application/octet-stream' }))
      .rejects.toThrow('private directory');
    expect(await fs.readdir(target)).toEqual([]);
  });
});

async function temporaryDirectory() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-web-fetch-'));
  roots.push(root);
  return root;
}
