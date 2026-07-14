import type { ILifecycleHookSource } from '../../domain/ports/ILifecycleHookSource.js';

type PluginHookManager = { listLifecycleHooks(workspaceRoot: string): ReturnType<ILifecycleHookSource['list']> };

export class TrustedPluginLifecycleHookSource implements ILifecycleHookSource {
  private readonly plugins: PluginHookManager;

  constructor(plugins: PluginHookManager) {
    this.plugins = plugins;
  }

  list(workspaceRoot: string) {
    return this.plugins.listLifecycleHooks(workspaceRoot);
  }
}
