import { AiProviderRequestError } from '../../domain/entities/modelRequest.js';

const MAX_PROVIDER_ERROR_CHARACTERS = 4_000;

export function createProviderHttpError(statusCode: number, body: string, retryAfterHeader: string | null) {
  const details = body.trim().slice(0, MAX_PROVIDER_ERROR_CHARACTERS);
  const message = `API Error (${statusCode})${details ? `: ${details}` : ''}`;
  const options = { statusCode, retryAfterMs: parseRetryAfterMs(retryAfterHeader) };
  if (statusCode === 408) return new AiProviderRequestError('timeout', message, options);
  if (statusCode === 429) return new AiProviderRequestError('rate_limit', message, options);
  if (statusCode === 529) return new AiProviderRequestError('overloaded', message, options);
  if (statusCode >= 500) return new AiProviderRequestError('server', message, options);
  if (statusCode === 401 || statusCode === 403) return new AiProviderRequestError('authentication', message, options);
  return new AiProviderRequestError('invalid_request', message, options);
}

export function createProviderTransportError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Provider network request failed.';
  return new AiProviderRequestError('network', message, { cause: error });
}

function parseRetryAfterMs(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : undefined;
}
