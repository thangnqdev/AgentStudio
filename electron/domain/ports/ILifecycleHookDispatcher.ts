import type { IntegratedLifecycleHookEvent, LifecycleHookResult } from '../entities/lifecycleHook.js';

export type LifecycleHookDispatchInput = {
  event: IntegratedLifecycleHookEvent;
  workspaceRoot: string;
  matchValue?: string;
  requestId?: string;
  toolName?: string;
};

export interface ILifecycleHookDispatcher {
  dispatch(input: LifecycleHookDispatchInput): Promise<LifecycleHookResult>;
}
