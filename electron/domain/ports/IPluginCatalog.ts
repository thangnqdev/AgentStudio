import type { LifecycleHookDefinition } from '../entities/lifecycleHook.js';
import type { PluginDescriptor } from '../entities/plugin.js';
import type { LspServerConfiguration } from '../entities/lspServer.js';

export interface IPluginCatalog {
  discover(workspaceRoot: string): Promise<PluginDescriptor[]>;
  readHooks(plugin: PluginDescriptor): Promise<LifecycleHookDefinition[]>;
  readLspServers(plugin: PluginDescriptor): Promise<LspServerConfiguration[]>;
  installFromDirectory(sourcePath: string): Promise<void>;
  removeManaged(plugin: PluginDescriptor): Promise<void>;
}
