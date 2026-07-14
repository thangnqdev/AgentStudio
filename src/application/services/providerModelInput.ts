import type { AIModel } from '../../domain/entities/settings';

export function parseProviderModelInput(value: string, knownModels: AIModel[] = []): AIModel[] {
  const knownById = new Map(knownModels.map((model) => [model.id, model]));
  const seen = new Set<string>();
  const models: AIModel[] = [];

  for (const rawId of value.split(/[\n,]+/)) {
    const id = rawId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push({ ...(knownById.get(id) ?? {}), id });
  }

  return models;
}
