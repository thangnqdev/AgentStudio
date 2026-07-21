import { describe, expect, it } from 'vitest';
import type { PluginPreferences } from '../../domain/entities/plugin.js';
import { ManagePlugins } from './ManagePlugins.js';

const plugin = {
  id: 'plugin-1', name: 'review-pack', description: 'Review hooks', origin: 'workspace' as const,
  rootPath: '/workspace/plugins/review-pack', manifestPath: '/workspace/plugins/review-pack/.claude-plugin/plugin.json',
  contentHash: 'hash', components: ['hooks' as const], unsupportedComponents: [],
};

describe('ManagePlugins', () => {
  it('requires content-bound trust before enabling and namespaces hook ids', async () => {
    let preferences: PluginPreferences = { enabledPluginIds: [], trustedPluginIds: [] };
    const manager = new ManagePlugins({
      discover: async () => [plugin],
      readHooks: async () => [{ id: 'guard', event: 'PreToolUse', matcher: 'run_*', actions: [{ type: 'deny_tool', reason: 'blocked' }] }],
      readLspServers: async () => [],
      installFromDirectory: async () => undefined,
      removeManaged: async () => undefined,
    }, {
      load: async () => structuredClone(preferences),
      save: async (next) => { preferences = structuredClone(next); },
    });

    await expect(manager.setEnabled('/workspace', plugin.id, true)).rejects.toThrow('Trust');
    await manager.setTrusted('/workspace', plugin.id, true);
    await manager.setEnabled('/workspace', plugin.id, true);
    await expect(manager.listLifecycleHooks('/workspace')).resolves.toMatchObject([{ id: 'plugin:plugin-1:guard' }]);
    await manager.setTrusted('/workspace', plugin.id, false);
    expect((await manager.list('/workspace'))[0]).toMatchObject({ trusted: false, enabled: false });
  });

  it('enables a trusted LSP-only plugin and lists its scoped servers', async () => {
    let preferences: PluginPreferences = { enabledPluginIds: [], trustedPluginIds: [] };
    const lspPlugin = { ...plugin, id: 'plugin-lsp', components: ['lspServers' as const], unsupportedComponents: [] };
    const server = { name: 'plugin:review-pack:typescript', command: 'typescript-language-server', args: ['--stdio'], extensionToLanguage: { '.ts': 'typescript' } };
    const manager = new ManagePlugins({
      discover: async () => [lspPlugin], readHooks: async () => [], readLspServers: async () => [server],
      installFromDirectory: async () => undefined, removeManaged: async () => undefined,
    }, {
      load: async () => structuredClone(preferences),
      save: async (next) => { preferences = structuredClone(next); },
    });
    await manager.setTrusted('/workspace', lspPlugin.id, true);
    await manager.setEnabled('/workspace', lspPlugin.id, true);
    await expect(manager.listLspServers('/workspace')).resolves.toEqual([server]);
  });
});
