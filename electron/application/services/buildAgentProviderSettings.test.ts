import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_RESILIENCE_POLICY } from '../../domain/entities/modelRequest.js';
import { DEFAULT_OPTIMIZATION_CONFIG } from '../../domain/entities/optimizer.js';
import type { StoredProvider, StoredSettings } from '../../domain/entities/settings.js';
import { buildAgentProviderSettings } from './buildAgentProviderSettings.js';

describe('buildAgentProviderSettings', () => {
  it('keeps command timeout separate from the model request deadline', () => {
    const provider: StoredProvider = {
      id: 'provider-1',
      name: 'Provider',
      baseUrl: 'https://provider.test/v1',
      models: [
        { id: 'primary', contextWindow: 32_000 },
        { id: 'optimized', contextWindow: 64_000 },
        { id: 'fallback' },
      ],
    };
    const settings: StoredSettings = {
      providers: [provider],
      activeProviderId: provider.id,
      activeModelId: 'primary',
      fallbackModelId: 'fallback',
      permissionMode: 'workspace-write',
      workspacePath: '/workspace',
      themePreference: 'system',
    };

    const result = buildAgentProviderSettings({
      settings,
      provider,
      apiKey: 'secret',
      tuning: { ...DEFAULT_OPTIMIZATION_CONFIG, modelChoice: 'optimized', timeoutMs: 15_000 },
    });

    expect(result).toMatchObject({
      model: 'optimized',
      fallbackModels: ['fallback'],
      contextWindow: 64_000,
      requestTimeoutMs: DEFAULT_MODEL_RESILIENCE_POLICY.requestTimeoutMs,
    });
    expect(result.requestTimeoutMs).not.toBe(DEFAULT_OPTIMIZATION_CONFIG.timeoutMs);
  });
});
