import type { PermissionMode } from '../../domain/entities/agent.js';
import type {
  ModelMetadata,
  StoredProvider,
  StoredSettings,
} from '../../domain/entities/settings.js';

export function toPublicSettings(settings: StoredSettings) {
  return {
    providers: settings.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      models: provider.models.map((model) => ({ ...model })),
      hasApiKey: Boolean(provider.encryptedApiKey || provider.plainApiKey),
    })),
    activeProviderId: settings.activeProviderId,
    activeModelId: settings.activeModelId,
    fallbackModelId: settings.fallbackModelId,
    permissionMode: settings.permissionMode,
    workspacePath: settings.workspacePath,
  };
}

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) throw new Error('Base URL không được để trống.');
  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL chỉ hỗ trợ HTTP hoặc HTTPS.');
  }
  return url.toString().replace(/\/$/, '');
}

export function normalizePermissionMode(value: unknown): PermissionMode {
  if (value === 'read-only' || value === 'workspace-write' || value === 'danger-full-access') {
    return value;
  }
  return 'workspace-write';
}

export function normalizeModelList(value: unknown): ModelMetadata[] {
  if (!Array.isArray(value)) return [];
  const models: ModelMetadata[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const model = readModelMetadata(item);
    if (!model || seen.has(model.id)) continue;
    seen.add(model.id);
    models.push(model);
  }
  return models;
}

export function hasModel(
  provider: StoredProvider | null | undefined,
  modelId: string | null | undefined,
): boolean {
  return Boolean(provider && modelId && provider.models.some((model) => model.id === modelId));
}

export function firstModelId(provider: StoredProvider | null | undefined): string | null {
  return provider?.models[0]?.id ?? null;
}

function readModelMetadata(value: unknown): ModelMetadata | null {
  if (typeof value === 'string') return value ? { id: value } : null;
  if (!isObject(value)) return null;
  const id = stringValue(value.id) || stringValue(value.name);
  if (!id) return null;
  const contextWindow = readContextWindow(value);
  return contextWindow ? { id, contextWindow } : { id };
}

function readContextWindow(value: Record<string, unknown>): number | undefined {
  const directFields = [
    'contextWindow', 'context_window', 'contextLength', 'context_length',
    'maxContextLength', 'max_context_length', 'maxContextWindow', 'max_context_window',
    'maxModelLen', 'max_model_len', 'maxPositionEmbeddings', 'max_position_embeddings',
    'n_ctx', 'num_ctx', 'context', 'context_size', 'token_limit',
  ];
  for (const field of directFields) {
    const parsed = positiveInteger(value[field]);
    if (parsed) return parsed;
  }
  for (const field of ['metadata', 'details', 'info', 'parameters', 'config', 'top_provider', 'context']) {
    const nested = value[field];
    if (!isObject(nested)) continue;
    const parsed = readContextWindow(nested);
    if (parsed) return parsed;
  }
  return undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const number = typeof value === 'number'
    ? value
    : typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number.NaN;
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
