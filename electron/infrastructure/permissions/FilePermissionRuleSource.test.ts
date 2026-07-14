import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { FilePermissionRuleSource } from './FilePermissionRuleSource.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('FilePermissionRuleSource', () => {
  it('loads and assigns trusted source metadata', async () => {
    const target = await temporaryFile('[{"id":"ask-shell","effect":"ask","toolGlob":"run_command"}]');
    const source = createSource(target, 'workspace', ['deny', 'ask']);
    await expect(source.list('/workspace')).resolves.toEqual([
      { id: 'ask-shell', effect: 'ask', source: 'workspace', toolGlob: 'run_command', risk: undefined, pathGlob: undefined, commandPrefix: undefined },
    ]);
  });

  it('treats a missing rule file as an empty rule set', async () => {
    const root = await temporaryDirectory();
    await expect(createSource(path.join(root, 'missing.json'), 'user', ['allow', 'ask', 'deny']).list('/workspace')).resolves.toEqual([]);
  });

  it('rejects workspace allow rules', async () => {
    const target = await temporaryFile('[{"effect":"allow","toolGlob":"*"}]');
    await expect(createSource(target, 'workspace', ['deny', 'ask']).list('/workspace')).rejects.toThrow('invalid effect');
  });

  it.runIf(process.platform !== 'win32')('rejects symbolic-link rule files', async () => {
    const target = await temporaryFile('[]');
    const link = `${target}.link`;
    await fs.symlink(target, link);
    await expect(createSource(link, 'user', ['allow', 'ask', 'deny']).list('/workspace')).rejects.toThrow('symbolic link');
  });
});

function createSource(target: string, source: 'workspace' | 'user', allowedEffects: readonly ('allow' | 'ask' | 'deny')[]) {
  return new FilePermissionRuleSource({ source, allowedEffects, resolvePath: () => target });
}

async function temporaryDirectory() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-permissions-'));
  temporaryDirectories.push(dir);
  return dir;
}

async function temporaryFile(contents: string) {
  const dir = await temporaryDirectory();
  const target = path.join(dir, 'rules.json');
  await fs.writeFile(target, contents, 'utf8');
  return target;
}
