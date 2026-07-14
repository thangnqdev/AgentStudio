import type { AIModel } from '../../domain/entities/settings';

export interface ProviderDraft {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: AIModel[];
  modelInput: string;
  hasApiKey?: boolean;
}

export type ProviderSaveMode = 'manual' | 'scan';
