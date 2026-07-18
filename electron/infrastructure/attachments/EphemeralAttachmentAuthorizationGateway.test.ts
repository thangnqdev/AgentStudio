import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES } from '../../domain/entities/limits.js';
import { EphemeralAttachmentAuthorizationGateway } from './EphemeralAttachmentAuthorizationGateway.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('EphemeralAttachmentAuthorizationGateway', () => {
  it('pins a picker-selected regular file to an opaque token and trusted metadata', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'notes.txt');
    await fs.writeFile(filePath, 'hello');
    const gateway = new EphemeralAttachmentAuthorizationGateway();

    const grant = await gateway.authorize({
      filePath, name: 'forged-name.txt', type: 'text', mimeType: 'text/plain', reportedSize: 5,
    });

    expect(grant.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(grant.attachment).toMatchObject({ filePath, name: 'notes.txt', type: 'text', size: 5 });
    await expect(gateway.resolve(grant.token)).resolves.toEqual(grant.attachment);
  });

  it('invalidates the capability when the selected file changes', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'notes.txt');
    await fs.writeFile(filePath, 'hello');
    const gateway = new EphemeralAttachmentAuthorizationGateway();
    const grant = await gateway.authorize({ filePath, name: 'notes.txt', type: 'text', reportedSize: 5 });

    await fs.writeFile(filePath, 'changed');
    await expect(gateway.resolve(grant.token)).resolves.toBeNull();
  });

  it('rejects size mismatches and oversized text files', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'notes.txt');
    await fs.writeFile(filePath, 'hello');
    const gateway = new EphemeralAttachmentAuthorizationGateway();
    await expect(gateway.authorize({ filePath, name: 'notes.txt', type: 'text', reportedSize: 4 }))
      .rejects.toThrow('changed');

    await fs.writeFile(filePath, Buffer.alloc(MAX_FILE_BYTES + 1));
    await expect(gateway.authorize({ filePath, name: 'notes.txt', type: 'text' }))
      .rejects.toThrow('too large');
  });

  it.skipIf(process.platform === 'win32')('rejects symbolic links', async () => {
    const directory = await temporaryDirectory();
    const target = path.join(directory, 'target.txt');
    const link = path.join(directory, 'link.txt');
    await fs.writeFile(target, 'hello');
    await fs.symlink(target, link);

    const gateway = new EphemeralAttachmentAuthorizationGateway();
    await expect(gateway.authorize({ filePath: link, name: 'link.txt', type: 'text' }))
      .rejects.toThrow('Symbolic-link');
  });
});

async function temporaryDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-attachment-'));
  temporaryDirectories.push(directory);
  return directory;
}
