import type { PluginDescriptor } from '../../domain/entities/plugin.js';
import type { IPluginCatalog } from '../../domain/ports/IPluginCatalog.js';
import type { IPluginPreferencesRepository } from '../../domain/ports/IPluginPreferencesRepository.js';

export class ManagePlugins {
  private readonly catalog: IPluginCatalog;
  private readonly preferences: IPluginPreferencesRepository;

  constructor(catalog: IPluginCatalog, preferences: IPluginPreferencesRepository) {
    this.catalog = catalog;
    this.preferences = preferences;
  }

  async list(workspaceRoot: string) {
    const [plugins, preferences] = await Promise.all([this.catalog.discover(workspaceRoot), this.preferences.load()]);
    const enabled = new Set(preferences.enabledPluginIds);
    const trusted = new Set(preferences.trustedPluginIds);
    return plugins.map((plugin) => ({ ...plugin, enabled: enabled.has(plugin.id), trusted: trusted.has(plugin.id) }));
  }

  async setTrusted(workspaceRoot: string, pluginId: string, trusted: boolean) {
    await this.ensureExists(workspaceRoot, pluginId);
    const preferences = await this.preferences.load();
    preferences.trustedPluginIds = updateSet(preferences.trustedPluginIds, pluginId, trusted);
    if (!trusted) preferences.enabledPluginIds = updateSet(preferences.enabledPluginIds, pluginId, false);
    await this.preferences.save(preferences);
    return this.list(workspaceRoot);
  }

  async setEnabled(workspaceRoot: string, pluginId: string, enabled: boolean) {
    const plugin = await this.ensureExists(workspaceRoot, pluginId);
    const preferences = await this.preferences.load();
    if (enabled && !preferences.trustedPluginIds.includes(pluginId)) throw new Error('Trust the plugin before enabling it.');
    if (enabled) {
      if (!plugin.components.some((component) => component === 'hooks' || component === 'lspServers')) {
        throw new Error('This plugin has no supported declarative hooks or LSP servers.');
      }
      await Promise.all([
        plugin.components.includes('hooks') ? this.catalog.readHooks(plugin) : Promise.resolve([]),
        plugin.components.includes('lspServers') ? this.catalog.readLspServers(plugin) : Promise.resolve([]),
      ]);
    }
    preferences.enabledPluginIds = updateSet(preferences.enabledPluginIds, pluginId, enabled);
    await this.preferences.save(preferences);
    return this.list(workspaceRoot);
  }

  async listLifecycleHooks(workspaceRoot: string) {
    const active = (await this.list(workspaceRoot)).filter((plugin) => plugin.enabled && plugin.trusted && plugin.components.includes('hooks'));
    const loaded = await Promise.all(active.map(async (plugin) => ({ plugin, hooks: await this.catalog.readHooks(plugin) })));
    return loaded.flatMap(({ plugin, hooks }) => hooks.map((hook) => ({ ...hook, id: `plugin:${plugin.id}:${hook.id}` })));
  }

  async listLspServers(workspaceRoot: string) {
    const active = (await this.list(workspaceRoot)).filter((plugin) => plugin.enabled && plugin.trusted && plugin.components.includes('lspServers'));
    return (await Promise.all(active.map((plugin) => this.catalog.readLspServers(plugin)))).flat();
  }

  private async ensureExists(workspaceRoot: string, pluginId: string): Promise<PluginDescriptor> {
    const plugin = (await this.catalog.discover(workspaceRoot)).find((item) => item.id === pluginId);
    if (!plugin) throw new Error('Plugin does not exist or its content changed.');
    return plugin;
  }
}

function updateSet(values: string[], value: string, included: boolean) {
  const next = new Set(values);
  if (included) next.add(value); else next.delete(value);
  return [...next];
}
