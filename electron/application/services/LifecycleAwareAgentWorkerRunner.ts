import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { IAgentWorkerRunner, AgentWorkerRunCallbacks } from '../../domain/ports/IAgentWorkerRunner.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';

export class LifecycleAwareAgentWorkerRunner implements IAgentWorkerRunner {
  private readonly runner: IAgentWorkerRunner;
  private readonly hooks: ILifecycleHookDispatcher;

  constructor(runner: IAgentWorkerRunner, hooks: ILifecycleHookDispatcher) {
    this.runner = runner;
    this.hooks = hooks;
  }

  async run(worker: AgentWorkerRecord, callbacks: AgentWorkerRunCallbacks, signal: AbortSignal) {
    await this.dispatch('SubagentStart', worker);
    try { return await this.runner.run(worker, callbacks, signal); }
    finally { await this.dispatch('SubagentStop', worker); }
  }

  private async dispatch(event: 'SubagentStart' | 'SubagentStop', worker: AgentWorkerRecord) {
    await this.hooks.dispatch({
      event, workspaceRoot: worker.workspaceRoot,
      matchValue: worker.subagentType ?? worker.name ?? worker.description,
      requestId: worker.id, taskId: worker.id,
    }).catch(() => undefined);
  }
}
