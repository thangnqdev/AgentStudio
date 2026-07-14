import { McpSettingsPanel } from './settings/McpSettingsPanel';
import { ProviderSettingsPanel } from './settings/ProviderSettingsPanel';
import { SkillSettingsPanel } from './settings/SkillSettingsPanel';
import { WebSearchSettings } from './WebSearchSettings';

export function SettingsView() {
  return (
    <div className="flex-1 overflow-y-auto pb-32">
      <div className="max-w-[800px] mx-auto w-full px-6 pt-12 flex flex-col gap-8">
        <div className="border-b border-outline-variant pb-6">
          <div className="flex items-center gap-2 text-secondary mb-2">
            <span className="material-symbols-outlined text-[18px]">settings</span>
            <span className="font-ui-label-caps text-ui-label-caps uppercase tracking-wider">Cấu hình</span>
          </div>
          <h2 className="font-display-serif text-[32px] leading-tight text-primary">Cài đặt AI</h2>
          <p className="font-ui-body text-ui-body text-on-surface-variant mt-2">
            Quản lý provider, model và các kết nối mở rộng của AgentStudio.
          </p>
        </div>
        <ProviderSettingsPanel />
        <WebSearchSettings />
        <SkillSettingsPanel />
        <McpSettingsPanel />
      </div>
    </div>
  );
}
