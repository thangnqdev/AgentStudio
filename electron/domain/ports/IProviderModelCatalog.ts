import type { ModelMetadata } from '../entities/settings.js';

export interface IProviderModelCatalog {
  listModels(baseUrl: string, apiKey: string): Promise<ModelMetadata[]>;
}
