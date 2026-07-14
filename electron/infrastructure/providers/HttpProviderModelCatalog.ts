import { normalizeModelList } from '../../application/services/providerSettings.js';
import type { ModelMetadata } from '../../domain/entities/settings.js';
import type { IProviderModelCatalog } from '../../domain/ports/IProviderModelCatalog.js';

const MODEL_FETCH_TIMEOUT_MS = 15_000;

export class HttpProviderModelCatalog implements IProviderModelCatalog {
  private readonly timeoutMs: number;

  constructor(timeoutMs = MODEL_FETCH_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  async listModels(baseUrl: string, apiKey: string): Promise<ModelMetadata[]> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(new URL('models', `${baseUrl.replace(/\/$/, '')}/`), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`Provider không phản hồi trong vòng ${Math.ceil(this.timeoutMs / 1_000)} giây.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const data: unknown = await response.json();
    if (isObject(data) && Array.isArray(data.data)) return normalizeModelList(data.data);
    if (isObject(data) && Array.isArray(data.models)) return normalizeModelList(data.models);
    if (Array.isArray(data)) return normalizeModelList(data);
    throw new Error('Định dạng danh sách model không hợp lệ từ server.');
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
