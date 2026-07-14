import { LifecycleHookDispatcher } from './application/services/LifecycleHookDispatcher.js';
import { FileSystemLifecycleHookSource } from './infrastructure/hooks/FileSystemLifecycleHookSource.js';
import { JsonlLifecycleHookAuditLogger } from './infrastructure/hooks/JsonlLifecycleHookAuditLogger.js';
import { LifecycleHookPermissionRuleSource } from './infrastructure/hooks/LifecycleHookPermissionRuleSource.js';
import { CompositeLifecycleHookSource } from './infrastructure/hooks/CompositeLifecycleHookSource.js';
import { TrustedPluginLifecycleHookSource } from './infrastructure/plugins/TrustedPluginLifecycleHookSource.js';
import { pluginManager } from './pluginRuntime.js';

const workspaceHookSource = new FileSystemLifecycleHookSource();
export const lifecycleHookSource = new CompositeLifecycleHookSource([
  workspaceHookSource,
  new TrustedPluginLifecycleHookSource(pluginManager),
]);
export const lifecycleHookDispatcher = new LifecycleHookDispatcher(lifecycleHookSource, new JsonlLifecycleHookAuditLogger());
export const lifecycleHookPermissionRuleSource = new LifecycleHookPermissionRuleSource(lifecycleHookSource);
