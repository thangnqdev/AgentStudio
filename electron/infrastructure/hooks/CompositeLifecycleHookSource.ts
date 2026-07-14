import type { ILifecycleHookSource } from '../../domain/ports/ILifecycleHookSource.js';

export class CompositeLifecycleHookSource implements ILifecycleHookSource {
  private readonly sources: readonly ILifecycleHookSource[];

  constructor(sources: readonly ILifecycleHookSource[]) {
    this.sources = sources;
  }

  async list(workspaceRoot: string) {
    const hooks = (await Promise.all(this.sources.map((source) => source.list(workspaceRoot)))).flat();
    const identities = new Set<string>();
    for (const hook of hooks) {
      if (identities.has(hook.id)) throw new Error(`Duplicate lifecycle hook id across sources: ${hook.id}.`);
      identities.add(hook.id);
    }
    return hooks;
  }
}
