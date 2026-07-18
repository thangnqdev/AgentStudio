import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { buildSafeProcessEnvironment } from '../tools/sandbox/ProcessTree.js';

const MAX_JSON_RPC_MESSAGE_BYTES = 10_000_000;
const SHUTDOWN_TIMEOUT_MS = 2_000;

type JsonRpcHandler = (params: unknown) => unknown | Promise<unknown>;
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
};

export type LspProcessClient = {
  readonly started: boolean;
  start(command: string, args: string[], options?: { cwd?: string; env?: Record<string, string> }): Promise<void>;
  sendRequest(method: string, params: unknown, signal?: AbortSignal): Promise<unknown>;
  sendNotification(method: string, params: unknown): Promise<void>;
  onNotification(method: string, handler: JsonRpcHandler): void;
  onRequest(method: string, handler: JsonRpcHandler): void;
  stop(): Promise<void>;
};

export class LspResponseError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'LspResponseError';
    this.code = code;
    this.data = data;
  }
}

export class JsonRpcMessageDecoder {
  private buffered = Buffer.alloc(0);

  push(chunk: Buffer): unknown[] {
    this.buffered = Buffer.concat([this.buffered, chunk]);
    const messages: unknown[] = [];
    while (this.buffered.length > 0) {
      const headerEnd = this.buffered.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const header = this.buffered.subarray(0, headerEnd).toString('ascii');
      const match = /^content-length:\s*(\d+)\s*$/im.exec(header);
      if (!match?.[1]) throw new Error('Invalid LSP message: Content-Length header is required.');
      const length = Number.parseInt(match[1], 10);
      if (!Number.isSafeInteger(length) || length < 0 || length > MAX_JSON_RPC_MESSAGE_BYTES) {
        throw new Error(`Invalid LSP message length: ${match[1]}.`);
      }
      const bodyStart = headerEnd + 4;
      if (this.buffered.length < bodyStart + length) break;
      const body = this.buffered.subarray(bodyStart, bodyStart + length).toString('utf8');
      this.buffered = this.buffered.subarray(bodyStart + length);
      messages.push(JSON.parse(body) as unknown);
    }
    return messages;
  }
}

export function encodeJsonRpcMessage(message: unknown) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'), body]);
}

export function createStdioLspClient(serverName: string): LspProcessClient {
  let child: ChildProcessWithoutNullStreams | undefined;
  let nextId = 1;
  let stopping = false;
  let decoder = new JsonRpcMessageDecoder();
  const pending = new Map<number, PendingRequest>();
  const notifications = new Map<string, JsonRpcHandler[]>();
  const requests = new Map<string, JsonRpcHandler>();

  const rejectPending = (error: Error) => {
    for (const request of pending.values()) { request.cleanup(); request.reject(error); }
    pending.clear();
  };

  const write = (message: unknown) => new Promise<void>((resolve, reject) => {
    if (!child?.stdin.writable) { reject(new Error(`LSP server ${serverName} is not running.`)); return; }
    child.stdin.write(encodeJsonRpcMessage(message), (error) => error ? reject(error) : resolve());
  });

  const respond = async (id: string | number, result?: unknown, error?: { code: number; message: string }) => {
    await write({ jsonrpc: '2.0', id, ...(error ? { error } : { result: result ?? null }) });
  };

  const handleMessage = async (raw: unknown) => {
    if (!isObject(raw)) return;
    if ((typeof raw.id === 'number' || typeof raw.id === 'string') && ('result' in raw || 'error' in raw) && typeof raw.id === 'number') {
      const request = pending.get(raw.id);
      if (!request) return;
      pending.delete(raw.id); request.cleanup();
      if (isObject(raw.error)) {
        const code = typeof raw.error.code === 'number' ? raw.error.code : -32603;
        const message = typeof raw.error.message === 'string' ? raw.error.message : 'LSP request failed.';
        request.reject(new LspResponseError(code, message, raw.error.data));
      } else request.resolve(raw.result);
      return;
    }
    if (typeof raw.method !== 'string') return;
    if (raw.id === undefined) {
      for (const handler of notifications.get(raw.method) || []) await handler(raw.params);
      return;
    }
    if (typeof raw.id !== 'number' && typeof raw.id !== 'string') return;
    const handler = requests.get(raw.method);
    if (!handler) { await respond(raw.id, undefined, { code: -32601, message: `Method not found: ${raw.method}` }); return; }
    try { await respond(raw.id, await handler(raw.params)); }
    catch (error) { await respond(raw.id, undefined, { code: -32603, message: error instanceof Error ? error.message : 'Request handler failed.' }); }
  };

  return {
    get started() { return Boolean(child); },

    async start(command, args, options) {
      if (child) return;
      decoder = new JsonRpcMessageDecoder();
      const spawned = spawn(command, args, {
        cwd: options?.cwd,
        env: { ...buildSafeProcessEnvironment(), ...options?.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false,
      });
      child = spawned;
      spawned.stdout.on('data', (chunk: Buffer) => {
        try { for (const message of decoder.push(chunk)) void handleMessage(message).catch(rejectPending); }
        catch (error) { rejectPending(error instanceof Error ? error : new Error('Invalid LSP response.')); }
      });
      spawned.stderr.resume();
      spawned.stdin.on('error', (error) => { if (!stopping) rejectPending(error); });
      spawned.on('exit', (code) => {
        child = undefined;
        if (!stopping) rejectPending(new Error(`LSP server ${serverName} exited with code ${code ?? 'unknown'}.`));
      });
      await new Promise<void>((resolve, reject) => {
        const onSpawn = () => { cleanup(); resolve(); };
        const onError = (error: Error) => { cleanup(); child = undefined; reject(error); };
        const cleanup = () => { spawned.off('spawn', onSpawn); spawned.off('error', onError); };
        spawned.once('spawn', onSpawn);
        spawned.once('error', onError);
      });
      spawned.on('error', (error) => { if (!stopping) rejectPending(error); });
    },

    sendRequest(method, params, signal) {
      if (signal?.aborted) return Promise.reject(new Error(`LSP request ${method} cancelled.`));
      const id = nextId++;
      return new Promise<unknown>((resolve, reject) => {
        const abort = () => {
          pending.delete(id);
          void write({ jsonrpc: '2.0', method: '$/cancelRequest', params: { id } }).catch(() => undefined);
          reject(new Error(`LSP request ${method} cancelled.`));
        };
        const cleanup = () => signal?.removeEventListener('abort', abort);
        pending.set(id, { resolve, reject, cleanup });
        signal?.addEventListener('abort', abort, { once: true });
        void write({ jsonrpc: '2.0', id, method, params }).catch((error: Error) => {
          pending.delete(id); cleanup(); reject(error);
        });
      });
    },

    sendNotification(method, params) {
      return write({ jsonrpc: '2.0', method, params });
    },

    onNotification(method, handler) {
      notifications.set(method, [...(notifications.get(method) || []), handler]);
    },

    onRequest(method, handler) {
      requests.set(method, handler);
    },

    async stop() {
      const running = child;
      if (!running) return;
      stopping = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SHUTDOWN_TIMEOUT_MS);
      try {
        await this.sendRequest('shutdown', {}, controller.signal).catch(() => undefined);
        await this.sendNotification('exit', {}).catch(() => undefined);
      } finally {
        clearTimeout(timer);
        rejectPending(new Error(`LSP server ${serverName} stopped.`));
        running.kill('SIGTERM');
        child = undefined;
        stopping = false;
      }
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
