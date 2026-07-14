import type { AgentProviderSettings } from '../../domain/entities/agent.js';
import { DEFAULT_MODEL_RESILIENCE_POLICY } from '../../domain/entities/modelRequest.js';
import type { RuntimeOptimizationConfig } from '../../domain/entities/optimizer.js';
import type { StoredProvider, StoredSettings } from '../../domain/entities/settings.js';

export function buildAgentProviderSettings(input: {
  settings: StoredSettings;
  provider: StoredProvider;
  tuning: RuntimeOptimizationConfig;
  apiKey: string;
}): AgentProviderSettings {
  const { settings, provider, tuning } = input;
  const selectedModel = tuning.modelChoice && provider.models.some((model) => model.id === tuning.modelChoice)
    ? tuning.modelChoice
    : settings.activeModelId;
  const fallbackModel = settings.fallbackModelId
    && provider.models.some((model) => model.id === settings.fallbackModelId)
    && settings.fallbackModelId !== selectedModel
    ? settings.fallbackModelId
    : null;
  const modelContextWindows = Object.fromEntries(provider.models.flatMap((model) => (
    model.contextWindow ? [[model.id, model.contextWindow] as const] : []
  )));

  return {
    baseUrl: provider.baseUrl,
    apiKey: input.apiKey,
    model: selectedModel || '',
    fallbackModels: fallbackModel ? [fallbackModel] : [],
    modelContextWindows,
    retryCount: tuning.retryCount,
    requestTimeoutMs: DEFAULT_MODEL_RESILIENCE_POLICY.requestTimeoutMs,
    contextWindow: provider.models.find((model) => model.id === selectedModel)?.contextWindow,
    contextBudgetTokens: tuning.contextBudgetTokens,
    permissionMode: settings.permissionMode,
  };
}
