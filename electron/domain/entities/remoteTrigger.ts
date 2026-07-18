import type { AgentToolDefinition } from './tool.js';

export const REMOTE_TRIGGER_TOOL_NAME = 'RemoteTrigger';
export const MAX_REMOTE_TRIGGER_JSON_BYTES = 100_000;
export const REMOTE_TRIGGER_TIMEOUT_MS = 20_000;

export type RemoteTriggerAction = 'list' | 'get' | 'create' | 'update' | 'run';
export type RemoteTriggerInput = { action: RemoteTriggerAction; trigger_id?: string; body?: Record<string, unknown> };
export type RemoteTriggerOutput = { status: number; json: string };

export type RemoteTriggerSettings = {
  enabled: boolean;
  baseUrl?: string;
  bearerToken?: string;
};

export type PublicRemoteTriggerSettings = {
  enabled: boolean;
  baseUrl?: string;
  hasBearerToken: boolean;
};

export type SaveRemoteTriggerSettingsInput = {
  enabled: boolean;
  baseUrl?: string;
  bearerToken?: string;
  clearBearerToken?: boolean;
};

export const REMOTE_TRIGGER_TOOL_DEFINITION: AgentToolDefinition = {
  name: REMOTE_TRIGGER_TOOL_NAME,
  description: 'Manage scheduled remote agents through the configured trigger API. Authentication is added in-process and never exposed to the shell or model.',
  risk: 'network', readOnly: false, concurrencySafe: true, deferLoading: true,
  searchHint: 'manage scheduled remote agent triggers',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      action: { type: 'string', enum: ['list', 'get', 'create', 'update', 'run'] },
      trigger_id: { type: 'string', pattern: '^[\\w-]+$', description: 'Required for get, update, and run' },
      body: { type: 'object', additionalProperties: true, description: 'JSON body for create and update' },
    },
    required: ['action'],
  },
};

export function parseRemoteTriggerInput(value: Record<string, unknown>): RemoteTriggerInput {
  const keys = Object.keys(value);
  if (keys.some((key) => !['action', 'trigger_id', 'body'].includes(key))) throw new Error('RemoteTrigger received an unknown field.');
  const action = value.action;
  if (!isAction(action)) throw new Error('action must be one of list, get, create, update, or run.');
  const triggerId = value.trigger_id;
  if (triggerId !== undefined && (typeof triggerId !== 'string' || triggerId.length > 200 || !/^[\w-]+$/.test(triggerId))) {
    throw new Error('trigger_id must contain only letters, numbers, underscores, or hyphens.');
  }
  const body = value.body;
  if (body !== undefined && (!isObject(body) || Array.isArray(body))) throw new Error('body must be a JSON object.');
  if ((action === 'get' || action === 'update' || action === 'run') && !triggerId) throw new Error(`${action} requires trigger_id.`);
  if ((action === 'create' || action === 'update') && body === undefined) throw new Error(`${action} requires body.`);
  if ((action === 'list' || action === 'create') && triggerId !== undefined) throw new Error(`${action} does not accept trigger_id.`);
  if ((action === 'list' || action === 'get' || action === 'run') && body !== undefined) throw new Error(`${action} does not accept body.`);
  if (body !== undefined && new TextEncoder().encode(safeJson(body)).byteLength > MAX_REMOTE_TRIGGER_JSON_BYTES) throw new Error('Remote trigger body exceeds the 100,000-byte limit.');
  return { action, ...(triggerId ? { trigger_id: triggerId } : {}), ...(body ? { body } : {}) };
}

export function normalizeRemoteTriggerBaseUrl(value: string | undefined) {
  if (!value?.trim()) return undefined;
  if (value.length > 2_048) throw new Error('RemoteTrigger base URL is too long.');
  const url = new URL(value.trim());
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('RemoteTrigger requires HTTPS; HTTP is allowed only for loopback hosts.');
  if (url.username || url.password || url.search || url.hash) throw new Error('RemoteTrigger base URL must not contain credentials, query, or fragment.');
  return url.toString().replace(/\/$/, '');
}

export function normalizeRemoteTriggerToken(value: string | undefined) {
  if (!value) return undefined;
  if (value.length > 8_192 || value.includes('\r') || value.includes('\n') || value.includes('\u0000')) {
    throw new Error('RemoteTrigger bearer token is invalid or too long.');
  }
  return value;
}

function isAction(value: unknown): value is RemoteTriggerAction {
  return value === 'list' || value === 'get' || value === 'create' || value === 'update' || value === 'run';
}

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }

function safeJson(value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') throw new Error();
    return serialized;
  } catch { throw new Error('body must be valid JSON.'); }
}
