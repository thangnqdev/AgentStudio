import type { IKnowledgeConfigProvider } from '../../domain/ports/IKnowledgeConfigProvider.js';
import { settingsRepo } from '../JsonSettingsRepository.js';

export class SettingsKnowledgeConfigProvider implements IKnowledgeConfigProvider {
  async getEmbeddingConfig() {
    const settings = await settingsRepo.loadStoredSettings();
    const provider = settings.providers.find((item) => item.id === settings.activeProviderId);
    return provider ? { baseUrl: provider.baseUrl, apiKey: settingsRepo.decryptApiKey(provider) } : undefined;
  }
}
