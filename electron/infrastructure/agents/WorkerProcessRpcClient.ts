import {
  MAX_WORKER_PROCESS_MESSAGE_BYTES,
  parseWorkerProcessMessage,
  type AgentWorkerProcessEvent,
  type AgentWorkerProcessRequest,
  type AgentWorkerProcessResult,
} from '../../domain/entities/agentWorkerSessionProcess.js';

type Method = AgentWorkerProcessRequest['method'];
type Pending = { resolve(value: unknown): void; reject(error: Error): void; timeout: NodeJS.Timeout };
const METHOD_TIMEOUT_MS: Record<Method, number> = {
  'tools.list': 30_000,
  'tool.run': 600_000,
  checkpoint: 60_000,
  'messages.drain': 60_000,
  'hook.dispatch': 30_000,
  'trace.record': 30_000,
};

export class WorkerProcessRpcClient {
  private readonly pending = new Map<string, Pending>();
  private readonly onFailure: (error: Error) => void;
  private sequence = 0;
  private failure?: Error;

  constructor(onFailure: (error: Error) => void) {
    this.onFailure = onFailure;
    process.on('message', (raw: unknown) => this.receive(raw));
    process.once('disconnect', () => this.fail(new Error('Agent worker parent disconnected.')));
  }

  request(method: Method, payload: unknown): Promise<unknown> {
    if (this.failure) return Promise.reject(this.failure);
    if (!process.send || !process.connected) return Promise.reject(new Error('Agent worker IPC channel is unavailable.'));
    const id = `rpc-${process.pid}-${++this.sequence}`;
    const message = { kind: 'request', id, method, payload } as AgentWorkerProcessRequest;
    assertMessageSize(message);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id); reject(new Error(`Agent worker ${method} request timed out.`));
      }, METHOD_TIMEOUT_MS[method]);
      timeout.unref();
      this.pending.set(id, { resolve, reject, timeout });
      process.send?.(message, (error) => { if (error) this.rejectPending(id, error); });
    });
  }

  emit(event: AgentWorkerProcessEvent) { this.send(event); }

  finish(result: AgentWorkerProcessResult) {
    return new Promise<void>((resolve) => {
      if (!process.send || !process.connected) { resolve(); return; }
      assertMessageSize(result);
      process.send(result, () => { process.disconnect(); resolve(); });
    });
  }

  private receive(raw: unknown) {
    try {
      assertMessageSize(raw);
      const message = parseWorkerProcessMessage(raw);
      if (message.kind !== 'response') throw new Error('Agent worker received a non-response on the child channel.');
      const pending = this.pending.get(message.id);
      if (!pending) throw new Error('Agent worker received an unknown response id.');
      this.pending.delete(message.id); clearTimeout(pending.timeout);
      if (message.ok) pending.resolve(message.result); else pending.reject(new Error(message.error));
    } catch (error) {
      this.fail(toError(error));
    }
  }

  private send(message: AgentWorkerProcessEvent) {
    if (this.failure || !process.send || !process.connected) return;
    assertMessageSize(message); process.send(message, (error) => { if (error) this.fail(error); });
  }

  private rejectPending(id: string, error: Error) {
    const pending = this.pending.get(id); if (!pending) return;
    this.pending.delete(id); clearTimeout(pending.timeout); pending.reject(error);
  }

  private fail(error: Error) {
    if (this.failure) return;
    this.failure = error;
    for (const [id, pending] of this.pending) { clearTimeout(pending.timeout); pending.reject(error); this.pending.delete(id); }
    this.onFailure(error);
  }
}

function assertMessageSize(value: unknown) {
  let serialized = '';
  try { serialized = JSON.stringify(value); } catch { throw new Error('Agent worker IPC message is not serializable.'); }
  if (Buffer.byteLength(serialized) > MAX_WORKER_PROCESS_MESSAGE_BYTES) throw new Error('Agent worker IPC message is too large.');
}
function toError(error: unknown) { return error instanceof Error ? error : new Error('Agent worker IPC failed.'); }
