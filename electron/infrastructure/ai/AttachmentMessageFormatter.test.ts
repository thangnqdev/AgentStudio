import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AttachmentMessageFormatter } from './AttachmentMessageFormatter.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('AttachmentMessageFormatter', () => {
  it('reads an authorized regular text file through a bounded file handle', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'notes.txt');
    await fs.writeFile(filePath, 'trusted content');

    const messages = await new AttachmentMessageFormatter().format([{
      id: 'message-1', sender: 'user', content: 'Review', attachments: [{
        id: 'attachment-1', name: 'notes.txt', type: 'text', filePath,
      }],
    }]);

    expect(JSON.stringify(messages)).toContain('trusted content');
  });

  it.skipIf(process.platform === 'win32')('does not follow a symbolic-link attachment', async () => {
    const directory = await temporaryDirectory();
    const target = path.join(directory, 'secret.txt');
    const link = path.join(directory, 'notes.txt');
    await fs.writeFile(target, 'must-not-be-read');
    await fs.symlink(target, link);

    const messages = await new AttachmentMessageFormatter().format([{
      id: 'message-1', sender: 'user', content: '', attachments: [{
        id: 'attachment-1', name: 'notes.txt', type: 'text', filePath: link,
      }],
    }]);

    const serialized = JSON.stringify(messages);
    expect(serialized).toContain('Symbolic-link attachments are not allowed');
    expect(serialized).not.toContain('must-not-be-read');
  });
});

async function temporaryDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-formatter-'));
  temporaryDirectories.push(directory);
  return directory;
}
