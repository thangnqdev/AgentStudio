import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';

type ActiveWorker = {
  parentScopeId: string;
  background: boolean;
  controller: AbortController;
  promise: Promise<AgentWorkerRecord>;
};

export class AgentWorkerRunRegistry {
  private readonly active = new Map<string, ActiveWorker>();

  has(agentId: string) { return this.active.has(agentId); }
  get(agentId: string) { return this.active.get(agentId); }

  track(worker: Pick<AgentWorkerRecord, 'id' | 'parentScopeId' | 'background'>, controller: AbortController, operation: Promise<AgentWorkerRecord>) {
    const promise = operation.finally(() => this.active.delete(worker.id));
    this.active.set(worker.id, {
      parentScopeId: worker.parentScopeId, background: worker.background, controller, promise,
    });
    return promise;
  }

  async waitForBackground(parentScopeId: string, signal?: AbortSignal) {
    while (true) {
      const pending = [...this.active.values()]
        .filter((worker) => worker.parentScopeId === parentScopeId && worker.background)
        .map((worker) => worker.promise);
      if (pending.length === 0) return;
      await waitForSettled(pending, signal);
    }
  }

  async stopAll(reason: string) {
    for (const worker of this.active.values()) worker.controller.abort(reason);
    await Promise.allSettled([...this.active.values()].map((worker) => worker.promise));
  }
}

function waitForSettled(promises: Promise<unknown>[], signal?: AbortSignal) {
  const settled = Promise.allSettled(promises).then(() => undefined);
  if (!signal) return settled;
  if (signal.aborted) return Promise.reject(new Error('Agent session stopped.'));
  return new Promise<void>((resolve, reject) => {
    const abort = () => reject(new Error('Agent session stopped.'));
    signal.addEventListener('abort', abort, { once: true });
    void settled.then(() => { signal.removeEventListener('abort', abort); resolve(); });
  });
}
