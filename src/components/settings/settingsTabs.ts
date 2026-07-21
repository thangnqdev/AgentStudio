export type SettingsTabId = 'appearance' | 'providers' | 'search' | 'mcp' | 'skills' | 'plugins' | 'remote';

export interface SettingsTab {
  id: SettingsTabId;
  label: string;
  icon: string;
}

export const SETTINGS_TABS: SettingsTab[] = [
  { id: 'appearance', label: 'Giao diện', icon: 'contrast' },
  { id: 'providers', label: 'AI Providers', icon: 'smart_toy' },
  { id: 'search', label: 'Web Search', icon: 'travel_explore' },
  { id: 'mcp', label: 'MCP', icon: 'hub' },
  { id: 'skills', label: 'Skills', icon: 'psychology' },
  { id: 'plugins', label: 'Plugins', icon: 'extension' },
  { id: 'remote', label: 'Remote Trigger', icon: 'wifi_tethering' },
];
