export type PluginComponent = 'hooks' | 'skills' | 'agents' | 'commands' | 'mcpServers' | 'lspServers';

export type PluginStatus = {
  id: string;
  name: string;
  version?: string;
  description: string;
  origin: 'user' | 'workspace';
  rootPath: string;
  manifestPath: string;
  contentHash: string;
  components: PluginComponent[];
  unsupportedComponents: PluginComponent[];
  enabled: boolean;
  trusted: boolean;
};
