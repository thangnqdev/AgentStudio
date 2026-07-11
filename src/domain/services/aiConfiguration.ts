import type { AppSettings } from '../entities/settings';

export function hasUsableAiConfiguration(settings: AppSettings): boolean {
  const provider = settings.providers.find((item) => item.id === settings.activeProviderId);
  if (!provider || !settings.activeModelId) return false;

  return provider.models.some((model) => model.id === settings.activeModelId);
}
