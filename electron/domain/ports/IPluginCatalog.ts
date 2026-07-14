import type { LifecycleHookDefinition } from '../entities/lifecycleHook.js';
import type { PluginDescriptor } from '../entities/plugin.js';

export interface IPluginCatalog {
  discover(workspaceRoot: string): Promise<PluginDescriptor[]>;
  readHooks(plugin: PluginDescriptor): Promise<LifecycleHookDefinition[]>;
}
