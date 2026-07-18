import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/unused' },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: (value: Buffer) => value.toString().replace(/^encrypted:/, ''),
  },
}));

import { EncryptedRemoteTriggerSettingsRepository } from './EncryptedRemoteTriggerSettingsRepository.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((item) => fs.rm(item, { recursive: true, force: true }))));

describe('EncryptedRemoteTriggerSettingsRepository', () => {
  it('persists private settings without writing the bearer token in plaintext', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-remote-trigger-'));
    directories.push(root);
    const target = path.join(root, 'settings.json');
    const repository = new EncryptedRemoteTriggerSettingsRepository(target);
    await repository.save({ enabled: true, baseUrl: 'https://api.example.com', bearerToken: 'top-secret' });
    expect(await repository.load()).toEqual({ enabled: true, baseUrl: 'https://api.example.com', bearerToken: 'top-secret' });
    const raw = await fs.readFile(target, 'utf8');
    expect(raw).not.toContain('top-secret');
    expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
  });

  it('defaults to disabled and rejects symlink-backed settings', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-remote-trigger-'));
    directories.push(root);
    const missing = new EncryptedRemoteTriggerSettingsRepository(path.join(root, 'missing.json'));
    await expect(missing.load()).resolves.toEqual({ enabled: false });
    const outside = path.join(root, 'outside.json');
    const link = path.join(root, 'link.json');
    await fs.writeFile(outside, '{}');
    await fs.symlink(outside, link);
    await expect(new EncryptedRemoteTriggerSettingsRepository(link).load()).rejects.toThrow('unsafe');
  });
});
