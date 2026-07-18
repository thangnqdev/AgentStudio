import { CompositeWorkspaceFileChangeSink } from './application/services/CompositeWorkspaceFileChangeSink.js';
import { LifecycleHookFileChangeSink } from './application/services/LifecycleHookFileChangeSink.js';
import { lifecycleHookDispatcher } from './hookRuntime.js';
import { lspGateway } from './lspRuntime.js';

export const workspaceFileChanges = new CompositeWorkspaceFileChangeSink([
  lspGateway,
  new LifecycleHookFileChangeSink(lifecycleHookDispatcher),
]);
