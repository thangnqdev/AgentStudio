import { useState } from 'react';
import { McpSettingsPanel } from './settings/McpSettingsPanel';
import { ProviderSettingsPanel } from './settings/ProviderSettingsPanel';
import { SkillSettingsPanel } from './settings/SkillSettingsPanel';
import { WebSearchSettings } from './WebSearchSettings';
import { PluginSettingsPanel } from './settings/PluginSettingsPanel';
import { RemoteTriggerSettingsPanel } from './settings/RemoteTriggerSettingsPanel';
import { AppearanceSettingsPanel } from './settings/AppearanceSettingsPanel';
import { SettingsTabNavigation } from './settings/SettingsTabNavigation';
import type { SettingsTabId } from './settings/settingsTabs';

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('providers');

  return (
    <div className="settings-shell flex flex-1 flex-col overflow-hidden">
      <div className="settings-header border-b border-outline-variant px-6 pb-0 pt-8">
        <div className="flex items-center gap-2 text-secondary mb-1">
          <span className="material-symbols-outlined text-[16px]">settings</span>
          <span className="text-ui-label-caps uppercase tracking-wider text-[11px] font-semibold">Cấu hình</span>
        </div>
        <h2 className="text-[22px] font-semibold text-primary leading-tight mb-4">Cài đặt</h2>

        <SettingsTabNavigation activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="settings-content mx-auto w-full max-w-[760px] px-6 py-8">
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
