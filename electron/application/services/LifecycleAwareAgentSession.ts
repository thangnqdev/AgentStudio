import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';

type SessionRunner<TArguments extends unknown[], TResult> = { execute(...args: TArguments): Promise<TResult> };

export class LifecycleAwareAgentSession<TArguments extends unknown[], TResult> {
  private readonly session: SessionRunner<TArguments, TResult>;
  private readonly hooks: ILifecycleHookDispatcher;
  private readonly context: { workspaceRoot: () => string; requestId: string; taskId?: string };

  constructor(
    session: SessionRunner<TArguments, TResult>,
    hooks: ILifecycleHookDispatcher,
    context: { workspaceRoot: () => string; requestId: string; taskId?: string },
  ) {
    this.session = session;
    this.hooks = hooks;
    this.context = context;
  }

  async execute(...args: TArguments) {
    try {
      const result = await this.session.execute(...args);
      await this.dispatch('Stop');
      await this.dispatch('SessionEnd');
      return result;
    } catch (error) {
      await this.dispatch('StopFailure');
      await this.dispatch('SessionEnd');
      throw error;
    }
  }

  private async dispatch(event: 'Stop' | 'StopFailure' | 'SessionEnd') {
    await this.hooks.dispatch({
      event, workspaceRoot: this.context.workspaceRoot(), requestId: this.context.requestId,
      ...(this.context.taskId ? { taskId: this.context.taskId } : {}),
    }).catch(() => undefined);
  }
}
