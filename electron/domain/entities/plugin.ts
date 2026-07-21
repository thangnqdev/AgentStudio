export type PluginOrigin = 'user' | 'workspace';
export type PluginComponent = 'hooks' | 'skills' | 'agents' | 'commands' | 'mcpServers' | 'lspServers';

export type PluginDescriptor = {
  id: string;
  name: string;
  version?: string;
  description: string;
  origin: PluginOrigin;
  rootPath: string;
  managed?: boolean;
  manifestPath: string;
  contentHash: string;
  components: PluginComponent[];
  unsupportedComponents: PluginComponent[];
};

export type PluginPreferences = {
  enabledPluginIds: string[];
  trustedPluginIds: string[];
};

export type PluginStatus = PluginDescriptor & {
  enabled: boolean;
  trusted: boolean;
};
