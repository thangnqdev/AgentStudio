import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemPluginCatalog } from './FileSystemPluginCatalog.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('FileSystemPluginCatalog', () => {
  it('discovers Claude-compatible manifests and loads only declarative hooks', async () => {
    const root = await temporaryDirectory();
    const pluginRoot = path.join(root, 'review-pack');
    await writePlugin(pluginRoot, {
      name: 'review-pack', version: '1.0.0', description: 'Review policy', skills: './skills',
      hooks: { PreToolUse: [{ id: 'review-shell', matcher: 'run_*', actions: [{ type: 'require_approval', reason: 'Review shell.' }] }] },
    });
    const catalog = new FileSystemPluginCatalog([{ root, origin: 'workspace' }]);
    const plugins = await catalog.discover('/workspace');
    expect(plugins[0]).toMatchObject({ name: 'review-pack', components: ['hooks', 'skills'], unsupportedComponents: ['skills'] });
    await expect(catalog.readHooks(plugins[0])).resolves.toMatchObject([{ id: 'review-shell', event: 'PreToolUse' }]);
  });

  it('invalidates trust identity when hook content changes', async () => {
    const root = await temporaryDirectory();
    const pluginRoot = path.join(root, 'guard-pack');
    await writePlugin(pluginRoot, { name: 'guard-pack', hooks: 'hooks/hooks.json' });
    await fs.mkdir(path.join(pluginRoot, 'hooks'));
    const hooksPath = path.join(pluginRoot, 'hooks', 'hooks.json');
    await fs.writeFile(hooksPath, JSON.stringify({ hooks: { PreToolUse: [{ id: 'guard', actions: [{ type: 'deny_tool', reason: 'blocked' }] }] } }));
    const catalog = new FileSystemPluginCatalog([{ root, origin: 'workspace' }]);
    const plugin = (await catalog.discover('/workspace'))[0];
    await fs.writeFile(hooksPath, JSON.stringify({ hooks: { PreToolUse: [{ id: 'guard', actions: [{ type: 'deny_tool', reason: 'changed' }] }] } }));
    await expect(catalog.readHooks(plugin)).rejects.toThrow('content changed');
  });

  it('does not discover command hooks or path-escaping hook files', async () => {
    const root = await temporaryDirectory();
    await writePlugin(path.join(root, 'command-pack'), {
      name: 'command-pack', hooks: { PreToolUse: [{ id: 'shell', actions: [{ type: 'command', command: 'rm -rf .' }] }] },
    });
    await writePlugin(path.join(root, 'escape-pack'), { name: 'escape-pack', hooks: '../../outside.json' });
    const lspRoot = path.join(root, 'escape-lsp-pack');
    await writePlugin(lspRoot, { name: 'escape-lsp-pack', lspServers: { unsafe: {
      command: '../outside-server', extensionToLanguage: { '.ts': 'typescript' },
    } } });
    const plugins = await new FileSystemPluginCatalog([{ root, origin: 'workspace' }]).discover('/workspace');
    expect(plugins).toEqual([]);
  });

  it('loads scoped LSP servers and binds trust identity to .lsp.json content', async () => {
    const root = await temporaryDirectory();
    const dataRoot = path.join(root, '.data');
    const pluginRoot = path.join(root, 'typescript-pack');
    await writePlugin(pluginRoot, { name: 'typescript-pack' });
    const lspPath = path.join(pluginRoot, '.lsp.json');
    await fs.writeFile(lspPath, JSON.stringify({ typescript: {
      command: '${CLAUDE_PLUGIN_ROOT}/bin/server.js', args: ['--stdio'],
      extensionToLanguage: { '.ts': 'typescript' }, env: { PLUGIN_DATA: '${CLAUDE_PLUGIN_DATA}' },
    } }));
    const catalog = new FileSystemPluginCatalog([{ root, origin: 'workspace' }], dataRoot);
    const plugin = (await catalog.discover('/workspace'))[0]!;
    expect(plugin).toMatchObject({ components: ['lspServers'], unsupportedComponents: [] });
    await expect(catalog.readLspServers(plugin)).resolves.toEqual([expect.objectContaining({
      name: 'plugin:typescript-pack:typescript', command: path.join(plugin.rootPath, 'bin/server.js'),
      env: { PLUGIN_DATA: path.join(dataRoot, 'typescript-pack') },
    })]);
    await fs.writeFile(lspPath, JSON.stringify({ typescript: {
      command: 'changed-server', extensionToLanguage: { '.ts': 'typescript' },
    } }));
    await expect(catalog.readLspServers(plugin)).rejects.toThrow('content changed');
  });
});

async function temporaryDirectory() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-plugins-'));
  temporaryDirectories.push(dir);
  return dir;
}

async function writePlugin(pluginRoot: string, manifest: Record<string, unknown>) {
  await fs.mkdir(path.join(pluginRoot, '.claude-plugin'), { recursive: true });
  await fs.writeFile(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), JSON.stringify(manifest));
}
