import { useState } from 'react';
import { McpSettingsPanel } from './settings/McpSettingsPanel';
import { ProviderSettingsPanel } from './settings/ProviderSettingsPanel';
import { SkillSettingsPanel } from './settings/SkillSettingsPanel';
import { WebSearchSettings } from './WebSearchSettings';
import { PluginSettingsPanel } from './settings/PluginSettingsPanel';
import { RemoteTriggerSettingsPanel } from './settings/RemoteTriggerSettingsPanel';
import { AppearanceSettingsPanel } from './settings/AppearanceSettingsPanel';

type TabId = 'appearance' | 'providers' | 'search' | 'mcp' | 'skills' | 'plugins' | 'remote';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'appearance', label: 'Giao diện', icon: 'contrast' },
  { id: 'providers', label: 'AI Providers', icon: 'smart_toy' },
  { id: 'search', label: 'Web Search', icon: 'travel_explore' },
  { id: 'mcp', label: 'MCP', icon: 'hub' },
  { id: 'skills', label: 'Skills', icon: 'psychology' },
  { id: 'plugins', label: 'Plugins', icon: 'extension' },
  { id: 'remote', label: 'Remote Trigger', icon: 'wifi_tethering' },
];

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<TabId>('providers');

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-0 border-b border-outline-variant">
        <div className="flex items-center gap-2 text-secondary mb-1">
          <span className="material-symbols-outlined text-[16px]">settings</span>
          <span className="text-ui-label-caps uppercase tracking-wider text-[11px] font-semibold">Cấu hình</span>
        </div>
        <h2 className="text-[22px] font-semibold text-primary leading-tight mb-4">Cài đặt</h2>

        {/* Tab Bar */}
        <div className="flex items-end gap-0 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-secondary text-secondary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
                }
              `}
            >
              <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto w-full px-6 py-8">
          {activeTab === 'providers' && <ProviderSettingsPanel />}
          {activeTab === 'appearance' && <AppearanceSettingsPanel />}
          {activeTab === 'search' && <WebSearchSettings />}
          {activeTab === 'mcp' && <McpSettingsPanel />}
          {activeTab === 'skills' && <SkillSettingsPanel />}
          {activeTab === 'plugins' && <PluginSettingsPanel />}
          {activeTab === 'remote' && <RemoteTriggerSettingsPanel />}
        </div>
      </div>
    </div>
  );
}
