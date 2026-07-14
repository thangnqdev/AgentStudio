import type { LifecycleHookDefinition } from '../entities/lifecycleHook.js';

export interface ILifecycleHookSource {
  list(workspaceRoot: string): Promise<LifecycleHookDefinition[]>;
}
