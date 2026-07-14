import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemAgentProfileCatalog } from './FileSystemAgentProfileCatalog.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe('FileSystemAgentProfileCatalog', () => {
  it('discovers bounded read-only markdown profiles', async () => {
    const root = await temporaryRoot();
    await fs.writeFile(path.join(root, 'strict-reviewer.md'), '---\nname: strict-reviewer\ndescription: Review correctness\ntools: [read_file]\n---\nInspect evidence before reporting.', 'utf8');
    const catalog = new FileSystemAgentProfileCatalog([{ root, origin: 'workspace' }]);
    const profiles = await catalog.discover('/workspace');
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ name: 'strict-reviewer', origin: 'workspace', allowedTools: ['read_file'] });
    await expect(catalog.readInstructions(profiles[0])).resolves.toBe('Inspect evidence before reporting.');
  });

  it('ignores profiles that request mutation tools or whose filename mismatches the name', async () => {
    const root = await temporaryRoot();
    await fs.writeFile(path.join(root, 'unsafe.md'), '---\nname: unsafe\ndescription: Unsafe\ntools: [write_file]\n---\nWrite files.', 'utf8');
    await fs.writeFile(path.join(root, 'wrong.md'), '---\nname: another-name\ndescription: Wrong\n---\nRead files.', 'utf8');
    await expect(new FileSystemAgentProfileCatalog([{ root, origin: 'workspace' }]).discover('/workspace')).resolves.toEqual([]);
  });

  it('changes identity and rejects stale descriptors after profile content changes', async () => {
    const root = await temporaryRoot();
    const target = path.join(root, 'reviewer.md');
    await fs.writeFile(target, '---\nname: reviewer\ndescription: Review\n---\nFirst instructions.', 'utf8');
    const catalog = new FileSystemAgentProfileCatalog([{ root, origin: 'workspace' }]);
    const first = (await catalog.discover('/workspace'))[0];
    await fs.writeFile(target, '---\nname: reviewer\ndescription: Review\n---\nChanged instructions.', 'utf8');
    const second = (await catalog.discover('/workspace'))[0];
    expect(second.id).not.toBe(first.id);
    await expect(catalog.readInstructions(first)).rejects.toThrow('changed after trust');
  });

  it.runIf(process.platform !== 'win32')('ignores symlinks that escape the configured root', async () => {
    const root = await temporaryRoot();
    const outside = await temporaryRoot();
    const target = path.join(outside, 'escaped.md');
    await fs.writeFile(target, '---\nname: escaped\ndescription: Escape\n---\nInspect.', 'utf8');
    await fs.symlink(target, path.join(root, 'escaped.md'));
    await expect(new FileSystemAgentProfileCatalog([{ root, origin: 'workspace' }]).discover('/workspace')).resolves.toEqual([]);
  });
});

async function temporaryRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-agent-profile-'));
  roots.push(root);
  return root;
}
