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
});
