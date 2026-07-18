import {
  MAX_REMOTE_TRIGGER_JSON_BYTES,
  REMOTE_TRIGGER_TIMEOUT_MS,
  type RemoteTriggerInput,
  type RemoteTriggerOutput,
  type RemoteTriggerSettings,
} from '../../domain/entities/remoteTrigger.js';
import type { IRemoteTriggerGateway } from '../../domain/ports/IRemoteTriggerGateway.js';

export class HttpRemoteTriggerGateway implements IRemoteTriggerGateway {
  private readonly fetcher: typeof fetch;

  constructor(fetcher: typeof fetch = fetch) { this.fetcher = fetcher; }

  async execute(input: RemoteTriggerInput, settings: RemoteTriggerSettings, signal?: AbortSignal): Promise<RemoteTriggerOutput> {
    if (!settings.baseUrl || !settings.bearerToken) throw new Error('RemoteTrigger is not fully configured.');
    const request = buildRequest(input, settings.baseUrl);
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error('RemoteTrigger request timed out.')), REMOTE_TRIGGER_TIMEOUT_MS);
    try {
      const response = await this.fetcher(request.url, {
        method: request.method, redirect: 'manual', signal: controller.signal,
        headers: {
          authorization: `Bearer ${settings.bearerToken}`,
          accept: 'application/json',
          ...(request.body ? { 'content-type': 'application/json' } : {}),
        },
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      if (response.status >= 300 && response.status < 400) throw new Error('RemoteTrigger redirects are not allowed.');
      const body = redactToken(await readBoundedBody(response), settings.bearerToken);
      return { status: response.status, json: formatJson(body) };
    } catch (error) {
      if (controller.signal.aborted) {
        if (signal?.aborted) throw new Error('RemoteTrigger request stopped.');
        throw new Error('RemoteTrigger request timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}

function buildRequest(input: RemoteTriggerInput, baseUrl: string) {
  const root = `${baseUrl.replace(/\/$/, '')}/v1/code/triggers`;
  if (input.action === 'list') return { method: 'GET', url: root };
  if (input.action === 'create') return { method: 'POST', url: root, body: input.body };
  const target = `${root}/${encodeURIComponent(input.trigger_id!)}`;
  if (input.action === 'get') return { method: 'GET', url: target };
  if (input.action === 'update') return { method: 'POST', url: target, body: input.body };
  return { method: 'POST', url: `${target}/run`, body: {} };
}

async function readBoundedBody(response: Response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_REMOTE_TRIGGER_JSON_BYTES) throw new Error('RemoteTrigger response exceeds the 100,000-byte limit.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > MAX_REMOTE_TRIGGER_JSON_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error('RemoteTrigger response exceeds the 100,000-byte limit.');
    }
    chunks.push(chunk.value);
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: false }).decode(output);
}

function redactToken(value: string, token: string) {
  return value.includes(token)
    ? value.split(token).join('[REDACTED]').slice(0, MAX_REMOTE_TRIGGER_JSON_BYTES)
    : value;
}

function formatJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value)).slice(0, MAX_REMOTE_TRIGGER_JSON_BYTES);
  } catch {
    return JSON.stringify(value).slice(0, MAX_REMOTE_TRIGGER_JSON_BYTES);
  }
}
