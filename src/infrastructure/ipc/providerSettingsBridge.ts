import type { AppSettings, PermissionMode } from '../../domain/entities/settings';

function bridge() {
  if (!window.agentStudio) throw new Error('Electron bridge is not available.');
  return window.agentStudio;
}

export const ProviderSettingsBridge = {
  get isAvailable() { return typeof window !== 'undefined' && !!window.agentStudio; },
  load: () => bridge().loadSettings(),
  importLegacy: (settings: Parameters<NonNullable<Window['agentStudio']>['importLegacySettings']>[0]) => bridge().importLegacySettings(settings),
  saveProviderAndScan: (provider: Parameters<NonNullable<Window['agentStudio']>['saveProviderAndScan']>[0]) => bridge().saveProviderAndScan(provider),
  saveProvider: (provider: Parameters<NonNullable<Window['agentStudio']>['saveProvider']>[0]) => bridge().saveProvider(provider),
  deleteProvider: (providerId: string) => bridge().deleteProvider(providerId),
  setActiveProvider: (providerId: string) => bridge().setActiveProvider(providerId),
  setActiveModel: (modelId: string) => bridge().setActiveModel(modelId),
  setFallbackModel: (modelId: string) => bridge().setFallbackModel(modelId),
  setPermissionMode: (mode: PermissionMode) => bridge().setPermissionMode(mode),
  onChanged: (listener: (settings: AppSettings) => void) => window.agentStudio?.onSettingsChanged(listener) ?? (() => {}),
};
