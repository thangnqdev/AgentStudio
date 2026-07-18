import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { auth, type AuthResult, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { IMcpAuthSessionGateway, McpAuthSession } from '../../domain/ports/IMcpAuthSessionGateway.js';
import type { IMcpOAuthCredentialStore } from '../../domain/ports/IMcpOAuthCredentialStore.js';
import { McpSdkOAuthProvider } from './McpSdkOAuthProvider.js';

const CALLBACK_PATH = '/callback';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1_000;
type OAuthDriver = (provider: OAuthClientProvider, input: { serverUrl: string; authorizationCode?: string; scope?: string }) => Promise<AuthResult>;
type ActiveSession = { cancel: () => void };

export class LoopbackMcpAuthSessionGateway implements IMcpAuthSessionGateway {
  private readonly store: IMcpOAuthCredentialStore;
  private readonly driver: OAuthDriver;
  private readonly timeoutMs: number;
  private readonly pending = new Map<string, Promise<McpAuthSession>>();
  private readonly active = new Map<string, ActiveSession>();

  constructor(store: IMcpOAuthCredentialStore, driver: OAuthDriver = auth, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.store = store; this.driver = driver; this.timeoutMs = timeoutMs;
  }

  begin(input: { serverId: string; serverName: string; serverUrl: string; scope?: string }) {
    const existing = this.pending.get(input.serverId);
    if (existing) return existing;
    const operation = this.create(input).catch((error) => { this.pending.delete(input.serverId); throw error; });
    this.pending.set(input.serverId, operation);
    return operation;
  }

  async cancel(serverId: string) { this.active.get(serverId)?.cancel(); }
  async cancelAll() { await Promise.all([...this.active.keys()].map((serverId) => this.cancel(serverId))); }

  private async create(input: { serverId: string; serverName: string; serverUrl: string; scope?: string }): Promise<McpAuthSession> {
    const state = randomBytes(32).toString('base64url');
    let resolveCompletion!: () => void;
    let rejectCompletion!: (error: Error) => void;
    const completion = new Promise<void>((resolve, reject) => { resolveCompletion = resolve; rejectCompletion = reject; });
    void completion.catch(() => undefined);
    let settled = false;
    let callbackBusy = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const server = createServer();
    await listenLoopback(server);
    server.unref();
    const redirectUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}${CALLBACK_PATH}`;
    let authorizationUrl: string | undefined;
    const provider = new McpSdkOAuthProvider({
      serverId: input.serverId, redirectUrl, state, scope: input.scope, store: this.store,
      onRedirect: (url) => { authorizationUrl = url.toString(); },
    });
    const close = () => { if (timeout) clearTimeout(timeout); server.close(); this.active.delete(input.serverId); this.pending.delete(input.serverId); };
    const succeed = () => { if (settled) return; settled = true; close(); resolveCompletion(); };
    const fail = (message: string) => { if (settled) return; settled = true; close(); rejectCompletion(new Error(message)); };
    this.active.set(input.serverId, { cancel: () => fail('MCP authentication was cancelled.') });
    server.on('request', (request, response) => {
      if (callbackBusy || settled) { sendResponse(response, 409, 'Authentication callback is no longer available.'); return; }
      const callback = parseCallback(request.method, request.url, redirectUrl, state);
      if (!callback.ok) { sendResponse(response, callback.status, callback.message); return; }
      callbackBusy = true;
      void this.driver(provider, { serverUrl: input.serverUrl, authorizationCode: callback.code, scope: input.scope })
        .then((result) => {
          if (result !== 'AUTHORIZED') throw new Error('OAuth code exchange did not complete.');
          sendResponse(response, 200, `Authentication completed for ${input.serverName}. You can close this window.`);
          succeed();
        })
        .catch(() => { sendResponse(response, 500, 'Authentication could not be completed.'); fail('MCP OAuth code exchange failed.'); });
    });
    try {
      const result = await this.driver(provider, { serverUrl: input.serverUrl, scope: input.scope });
      if (result === 'AUTHORIZED') { succeed(); return { status: 'completed', completion }; }
      if (!authorizationUrl) throw new Error('MCP OAuth did not provide an authorization URL.');
      timeout = setTimeout(() => fail('MCP authentication timed out.'), this.timeoutMs);
      timeout.unref?.();
      return { status: 'authorization_required', authorizationUrl, completion };
    } catch (error) {
      fail('MCP OAuth could not be started.');
      throw error;
    }
  }
}

function listenLoopback(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
}

function parseCallback(method: string | undefined, rawUrl: string | undefined, redirectUrl: string, expectedState: string):
  { ok: true; code: string } | { ok: false; status: number; message: string } {
  if (method !== 'GET' || !rawUrl || rawUrl.length > 12_000) return { ok: false, status: 400, message: 'Invalid authentication callback.' };
  const url = new URL(rawUrl, redirectUrl);
  if (url.pathname !== CALLBACK_PATH) return { ok: false, status: 404, message: 'Not found.' };
  if (url.searchParams.has('error')) return { ok: false, status: 400, message: 'Authorization was not approved.' };
  const state = url.searchParams.get('state') || '';
  if (!safeEqual(state, expectedState)) return { ok: false, status: 400, message: 'Invalid OAuth state.' };
  const code = url.searchParams.get('code') || '';
  if (!code || code.length > 8_192) return { ok: false, status: 400, message: 'Invalid authorization code.' };
  return { ok: true, code };
}

function safeEqual(actual: string, expected: string) {
  const left = Buffer.from(actual); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sendResponse(response: import('node:http').ServerResponse, status: number, message: string) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'", 'X-Content-Type-Options': 'nosniff',
  });
  response.end(message);
}
