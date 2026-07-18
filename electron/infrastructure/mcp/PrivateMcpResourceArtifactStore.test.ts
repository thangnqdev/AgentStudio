import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PrivateMcpResourceArtifactStore } from './PrivateMcpResourceArtifactStore.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function createStore() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-studio-mcp-'));
  roots.push(root);
  const directory = path.join(root, 'artifacts');
  return { directory, store: new PrivateMcpResourceArtifactStore(() => directory) };
}

describe('PrivateMcpResourceArtifactStore', () => {
  it('decodes canonical base64 into a private MIME-derived file', async () => {
    const { directory, store } = await createStore();
    const result = await store.persistBase64({ base64: 'YWJj', mimeType: 'image/png; charset=binary' });
    expect(result.path).toMatch(/mcp-resource-.*\.png$/);
    expect(await fs.readFile(result.path, 'utf8')).toBe('abc');
    expect((await fs.stat(directory)).mode & 0o777).toBe(0o700);
    expect((await fs.stat(result.path)).mode & 0o777).toBe(0o600);
    expect((await store.persistBase64({ base64: '', mimeType: 'application/octet-stream' })).size).toBe(0);
  });

  it('rejects invalid base64 and symlink artifact directories', async () => {
    const { store } = await createStore();
    await expect(store.persistBase64({ base64: '../../etc/passwd', mimeType: 'text/plain' })).rejects.toThrow('valid base64');

    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-studio-mcp-link-'));
    roots.push(root);
    const real = path.join(root, 'real');
    const linked = path.join(root, 'linked');
    await fs.mkdir(real);
    await fs.symlink(real, linked);
    const linkedStore = new PrivateMcpResourceArtifactStore(() => linked);
    await expect(linkedStore.persistToolResult({ content: '{}' })).rejects.toThrow('not a private directory');
  });

  it('reads owned text in bounded character chunks and rejects invalid ranges', async () => {
    const { store } = await createStore();
    const saved = await store.persistToolResult({ content: 'a😀bcdef' });
    await expect(store.readTextArtifact({ path: saved.path, offset: 1, limit: 2 })).resolves.toEqual({
      content: '😀', offset: 1, nextOffset: 3, totalCharacters: 8,
    });
    await expect(store.readTextArtifact({ path: saved.path, offset: 0, limit: 100_001 }))
      .rejects.toThrow('limit must be an integer');
  });

  it('denies traversal, foreign files, and symlink replacement', async () => {
    const { directory, store } = await createStore();
    const saved = await store.persistToolResult({ content: '{"safe":true}' });
    const traversal = `${directory}${path.sep}nested${path.sep}..${path.sep}${path.basename(saved.path)}`;
    await expect(store.readTextArtifact({ path: traversal, offset: 0, limit: 10 }))
      .rejects.toThrow('not an owned MCP text artifact');

    const foreign = path.join(directory, 'mcp-tool-result-foreign.json');
    await fs.writeFile(foreign, 'private foreign content');
    await expect(store.readTextArtifact({ path: foreign, offset: 0, limit: 10 }))
      .rejects.toThrow('not an owned MCP text artifact');

    const outside = path.join(path.dirname(directory), 'outside.json');
    await fs.writeFile(outside, 'outside content');
    await fs.rm(saved.path);
    await fs.symlink(outside, saved.path);
    await expect(store.readTextArtifact({ path: saved.path, offset: 0, limit: 10 })).rejects.toThrow();
  });
});
