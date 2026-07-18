import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceSearchToolExecutor } from './WorkspaceSearchToolExecutor.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

async function workspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-search-'));
  directories.push(root);
  await fs.mkdir(path.join(root, 'src'));
  await fs.mkdir(path.join(root, 'node_modules'));
  await fs.writeFile(path.join(root, 'src', 'alpha.ts'), 'export const goal = 1;\nconst other = 2;\n');
  await fs.writeFile(path.join(root, 'src', 'beta.test.ts'), 'describe("goal", () => {});\n');
  await fs.writeFile(path.join(root, 'node_modules', 'ignored.ts'), 'goal');
  return root;
}

describe('WorkspaceSearchToolExecutor', () => {
  it('finds workspace files by glob while excluding generated dependency trees', async () => {
    const root = await workspace();
    const result = await new WorkspaceSearchToolExecutor().glob({ pattern: '**/*.ts' }, root, 'read-only');
    expect(result).toMatchObject({ ok: true });
    expect(result.output.split('\n').sort()).toEqual(['src/alpha.ts', 'src/beta.test.ts']);
  });

  it('returns bounded line evidence for literal and safe regex searches', async () => {
    const root = await workspace();
    const executor = new WorkspaceSearchToolExecutor();
    const literal = await executor.grep({ pattern: 'goal', glob: '**/*.ts' }, root, 'read-only');
    expect(literal.output).toContain('src/alpha.ts:1:');
    expect(literal.output).toContain('src/beta.test.ts:1:');
    const regex = await executor.grep({ pattern: '^export\\s+const', regex: true }, root, 'read-only');
    expect(regex.output).toContain('src/alpha.ts:1:');
  });

  it('rejects traversal globs, unsafe regex and pre-aborted searches', async () => {
    const root = await workspace();
    const executor = new WorkspaceSearchToolExecutor();
    await expect(executor.glob({ pattern: '../**' }, root, 'read-only')).rejects.toThrow('parent traversal');
    await expect(executor.grep({ pattern: '(a+)+$', regex: true }, root, 'read-only')).rejects.toThrow('unsafe');
    const controller = new AbortController(); controller.abort();
    await expect(executor.glob({ pattern: '**/*' }, root, 'read-only', controller.signal)).rejects.toThrow('stopped');
  });

  it('supports reference-style file, count, context and pagination modes', async () => {
    const root = await workspace();
    const executor = new WorkspaceSearchToolExecutor();
    await expect(executor.grep({ pattern: 'goal', outputMode: 'files_with_matches', typeGlob: '**/*.ts' }, root, 'read-only'))
      .resolves.toMatchObject({ output: expect.stringContaining('src/alpha.ts') });
    await expect(executor.grep({ pattern: 'goal', outputMode: 'count' }, root, 'read-only'))
      .resolves.toMatchObject({ output: expect.stringContaining('src/alpha.ts:1') });
    const content = await executor.grep({ pattern: 'goal', outputMode: 'content', contextAfter: 1, offset: 1, maxResults: 1 }, root, 'read-only');
    expect(content.output.split('\n')[0]).toContain('src/alpha.ts:2:');
  });

  it('matches bounded cross-line expressions only when multiline is enabled', async () => {
    const root = await workspace();
    const executor = new WorkspaceSearchToolExecutor();
    const singleLine = await executor.grep({ pattern: 'goal.*other', regex: true }, root, 'read-only');
    expect(singleLine.output).toBe('(no matches)');
    const multiline = await executor.grep({
      pattern: 'goal.*other', regex: true, multiline: true, outputMode: 'content',
    }, root, 'read-only');
    expect(multiline.output).toContain('src/alpha.ts:1:');
    expect(multiline.output).toContain('src/alpha.ts:2:');
  });
});
