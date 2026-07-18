import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileUserPermissionRuleWriter } from './FileUserPermissionRuleWriter.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

describe('FileUserPermissionRuleWriter', () => {
  it('atomically appends and deduplicates one exact WebFetch domain allow rule', async () => {
    const root = await temporaryDirectory();
    const target = path.join(root, 'permissions', 'rules.json');
    const writer = new FileUserPermissionRuleWriter(() => target);
    const request = {
      actionId: 'action', requestId: 'request', risk: 'network' as const, toolName: 'WebFetch',
      summary: 'url=https://docs.example.com', workspaceRoot: root, domain: 'docs.example.com',
    };
    await writer.allowDomain(request);
    await writer.allowDomain(request);
    const rules = JSON.parse(await fs.readFile(target, 'utf8'));
    expect(rules).toEqual([expect.objectContaining({ effect: 'allow', toolGlob: 'WebFetch', domainGlob: 'docs.example.com' })]);
    expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
  });

  it('refuses to overwrite a symbolic-link rule file', async () => {
    const root = await temporaryDirectory();
    const directory = path.join(root, 'permissions');
    await fs.mkdir(directory);
    const outside = path.join(root, 'outside.json');
    await fs.writeFile(outside, '[]');
    const target = path.join(directory, 'rules.json');
    await fs.symlink(outside, target);
    const writer = new FileUserPermissionRuleWriter(() => target);
    await expect(writer.allowDomain({
      actionId: 'a', requestId: 'r', risk: 'network', toolName: 'WebFetch', summary: '', workspaceRoot: root, domain: 'example.com',
    })).rejects.toThrow('unsafe');
    await expect(fs.readFile(outside, 'utf8')).resolves.toBe('[]');
  });
});

async function temporaryDirectory() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-user-permissions-'));
  roots.push(root);
  return root;
}
