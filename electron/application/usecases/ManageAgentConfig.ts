import type { AgentProviderSettings, PermissionMode } from '../../domain/entities/agent.js';
import { isAgentConfigSetting, type AgentConfigSetting } from '../../domain/entities/agentConfig.js';
import type { StoredProvider, StoredSettings } from '../../domain/entities/settings.js';
import type { ISettingsRepository } from '../../domain/ports/ISettingsRepository.js';
import { hasModel, toPublicSettings } from '../services/providerSettings.js';

const DISABLED_FALLBACK_VALUES = new Set(['', 'default', 'disabled', 'none']);

export type AgentConfigReadResult = {
  setting: AgentConfigSetting;
  value: string;
  options: string[];
};

export type AgentConfigMutationResult = {
  setting: AgentConfigSetting;
  previousValue: string;
  newValue: string;
  publicSettings: ReturnType<typeof toPublicSettings>;
  runtime: Pick<AgentProviderSettings, 'model' | 'fallbackModels' | 'contextWindow' | 'permissionMode'>;
};

export class ManageAgentConfig {
  private readonly repository: ISettingsRepository;

  constructor(repository: ISettingsRepository) { this.repository = repository; }

  async read(rawSetting: unknown): Promise<AgentConfigReadResult> {
    const setting = requireSetting(rawSetting);
    const settings = await this.repository.loadStoredSettings();
    return {
      setting,
      value: readValue(settings, setting),
      options: optionsFor(settings, setting),
    };
  }

  async write(rawSetting: unknown, rawValue: unknown): Promise<AgentConfigMutationResult> {
    const setting = requireSetting(rawSetting);
    if (typeof rawValue !== 'string') throw new Error(`${setting} requires a string value.`);
    const value = rawValue.trim();
    const settings = await this.repository.loadStoredSettings();
    const previousValue = readValue(settings, setting);
    applyValue(settings, setting, value);
    await this.repository.saveStoredSettings(settings);
    return {
      setting,
      previousValue,
      newValue: readValue(settings, setting),
      publicSettings: toPublicSettings(settings),
      runtime: runtimeProjection(settings),
    };
  }
}

function requireSetting(value: unknown): AgentConfigSetting {
  if (!isAgentConfigSetting(value)) throw new Error(`Unknown AgentStudio setting: ${String(value)}.`);
  return value;
}

function activeProvider(settings: StoredSettings): StoredProvider | undefined {
  return settings.providers.find((provider) => provider.id === settings.activeProviderId);
}

function readValue(settings: StoredSettings, setting: AgentConfigSetting): string {
  if (setting === 'model') return settings.activeModelId ?? '';
  if (setting === 'fallbackModel') return settings.fallbackModelId ?? 'disabled';
  return settings.permissionMode;
}

function optionsFor(settings: StoredSettings, setting: AgentConfigSetting): string[] {
  const provider = activeProvider(settings);
  if (setting === 'model') return provider?.models.map((model) => model.id) ?? [];
  if (setting === 'fallbackModel') {
    return ['disabled', ...(provider?.models.filter((model) => model.id !== settings.activeModelId).map((model) => model.id) ?? [])];
  }
  return ['read-only', 'workspace-write', 'danger-full-access'];
}

function applyValue(settings: StoredSettings, setting: AgentConfigSetting, value: string) {
  const provider = activeProvider(settings);
  if (setting === 'model') {
    if (!hasModel(provider, value)) throw new Error('Model does not belong to the active provider.');
    settings.activeModelId = value;
    if (settings.fallbackModelId === value) settings.fallbackModelId = null;
    return;
  }
  if (setting === 'fallbackModel') {
    if (DISABLED_FALLBACK_VALUES.has(value.toLowerCase())) settings.fallbackModelId = null;
    else if (value === settings.activeModelId) throw new Error('Fallback model must differ from the active model.');
    else if (!hasModel(provider, value)) throw new Error('Fallback model does not belong to the active provider.');
    else settings.fallbackModelId = value;
    return;
  }
  settings.permissionMode = requirePermissionMode(value);
}

function requirePermissionMode(value: string): PermissionMode {
  if (value === 'read-only' || value === 'workspace-write' || value === 'danger-full-access') return value;
  throw new Error('permissions.defaultMode must be read-only, workspace-write, or danger-full-access.');
}

function runtimeProjection(settings: StoredSettings): AgentConfigMutationResult['runtime'] {
  const provider = activeProvider(settings);
  const model = settings.activeModelId ?? '';
  const fallback = settings.fallbackModelId && settings.fallbackModelId !== model ? settings.fallbackModelId : undefined;
  return {
    model,
    fallbackModels: fallback ? [fallback] : [],
    contextWindow: provider?.models.find((candidate) => candidate.id === model)?.contextWindow,
    permissionMode: settings.permissionMode,
  };
}
