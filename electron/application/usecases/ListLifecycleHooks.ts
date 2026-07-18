import type { ILifecycleHookSource } from '../../domain/ports/ILifecycleHookSource.js';

export type LifecycleHookSummary = {
  id: string;
  event: string;
  matcher?: string;
  actionTypes: string[];
};

export class ListLifecycleHooks {
  private readonly source: ILifecycleHookSource;

  constructor(source: ILifecycleHookSource) {
    this.source = source;
  }

  async execute(workspaceRoot: string): Promise<LifecycleHookSummary[]> {
    return (await this.source.list(workspaceRoot))
      .map((definition) => ({
        id: definition.id,
        event: definition.event,
        ...(definition.matcher ? { matcher: definition.matcher } : {}),
        actionTypes: definition.actions.map((action) => action.type),
      }))
      .sort((left, right) => left.event.localeCompare(right.event) || left.id.localeCompare(right.id));
  }
}
