import type { AgentInteractionResponse } from '../../domain/entities/agentInteraction.js';
import type { IUserInteractionGateway } from '../../domain/ports/IUserInteractionGateway.js';

const DEFAULT_INTERACTION_TIMEOUT_MS = 600_000;

type PendingInteraction = {
  resolve(response: AgentInteractionResponse): void;
  reject(error: Error): void;
  timeout: NodeJS.Timeout;
  signal?: AbortSignal;
  abort?: () => void;
};

export class ElectronUserInteractionManager implements IUserInteractionGateway {
  private readonly pending = new Map<string, PendingInteraction>();
  private readonly timeoutMs: number;

  constructor(timeoutMs = DEFAULT_INTERACTION_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  waitForResponse(requestId: string, interactionId: string, signal?: AbortSignal) {
    const key = this.key(requestId, interactionId);
    this.reject(key, new Error('A newer interaction replaced this request.'));
    if (signal?.aborted) return Promise.reject(new Error('Agent session stopped.'));
    return new Promise<AgentInteractionResponse>((resolve, reject) => {
      const timeout = setTimeout(() => this.reject(key, new Error('User interaction timed out.')), this.timeoutMs);
      timeout.unref();
      const abort = signal ? () => this.reject(key, new Error('Agent session stopped.')) : undefined;
      signal?.addEventListener('abort', abort!, { once: true });
      this.pending.set(key, { resolve, reject, timeout, signal, abort });
    });
  }

  respond(requestId: string, interactionId: string, response: AgentInteractionResponse) {
    const key = this.key(requestId, interactionId);
    const pending = this.take(key);
    if (!pending) return false;
    pending.resolve(structuredClone(response));
    return true;
  }

  cancelRequest(requestId: string) {
    for (const key of [...this.pending.keys()]) {
      if (key.startsWith(`${requestId}:`)) this.reject(key, new Error('Agent session stopped.'));
    }
  }

  private reject(key: string, error: Error) {
    this.take(key)?.reject(error);
  }

  private take(key: string) {
    const pending = this.pending.get(key);
    if (!pending) return undefined;
    this.pending.delete(key);
    clearTimeout(pending.timeout);
    if (pending.signal && pending.abort) pending.signal.removeEventListener('abort', pending.abort);
    return pending;
  }

  private key(requestId: string, interactionId: string) {
    return `${requestId}:${interactionId}`;
  }
}
