import { describe, expect, it } from 'vitest';
import type { AppSettings } from '../entities/settings';
import { hasUsableAiConfiguration } from './aiConfiguration';

const emptySettings: AppSettings = {
  providers: [],
  activeProviderId: null,
  activeModelId: null,
  fallbackModelId: null,
  permissionMode: 'workspace-write',
  workspacePath: 'C:\\workspace',
};

describe('hasUsableAiConfiguration', () => {
  it('returns false when no provider is configured', () => {
    expect(hasUsableAiConfiguration(emptySettings)).toBe(false);
  });

  it('returns false when the selected model was not discovered for the provider', () => {
    expect(hasUsableAiConfiguration({
      ...emptySettings,
      providers: [{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: [] }],
      activeProviderId: 'openai',
      activeModelId: 'gpt-5',
    })).toBe(false);
  });

  it('accepts a selected discovered model, including local providers without an API key', () => {
    expect(hasUsableAiConfiguration({
      ...emptySettings,
      providers: [{ id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', models: [{ id: 'qwen3' }] }],
      activeProviderId: 'ollama',
      activeModelId: 'qwen3',
    })).toBe(true);
  });
});
