import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PrivateAgentPlanRepository } from './PrivateAgentPlanRepository.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

describe('PrivateAgentPlanRepository', () => {
  it('writes an unguessable owner-only plan outside the workspace contract', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-plans-'));
    roots.push(root);
    const directory = path.join(root, 'plans');
    const saved = await new PrivateAgentPlanRepository(directory).save('chat-a', '# Private plan');
    expect(saved.reference).toMatch(/^plan-[a-f0-9]{20}-[a-f0-9-]+\.md$/);
    const target = path.join(directory, saved.reference);
    expect(await fs.readFile(target, 'utf8')).toBe('# Private plan');
    if (process.platform !== 'win32') expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
  });

  it('rejects a symlinked output directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-plan-link-'));
    roots.push(root);
    const target = path.join(root, 'target');
    const link = path.join(root, 'link');
    await fs.mkdir(target);
    await fs.symlink(target, link, 'dir');
    await expect(new PrivateAgentPlanRepository(link).save('chat-a', '# Plan')).rejects.toThrow('unsafe');
  });
});
