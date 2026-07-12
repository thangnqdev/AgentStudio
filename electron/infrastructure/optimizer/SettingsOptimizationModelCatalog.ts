import type { IOptimizationModelCatalog } from '../../domain/ports/IOptimizationModelCatalog.js';
import type { JsonSettingsRepository } from '../JsonSettingsRepository.js';

export class SettingsOptimizationModelCatalog implements IOptimizationModelCatalog {
  private readonly settings: JsonSettingsRepository;
  constructor(settings: JsonSettingsRepository) { this.settings = settings; }
  async listAllowedModelIds() {
    const settings = await this.settings.loadStoredSettings();
    return settings.providers.find((provider) => provider.id === settings.activeProviderId)?.models.map((model) => model.id) ?? [];
  }
}
