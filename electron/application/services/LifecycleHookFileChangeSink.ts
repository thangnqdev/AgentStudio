import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';
import type { IWorkspaceFileChangeSink } from '../../domain/ports/IWorkspaceFileChangeSink.js';

export class LifecycleHookFileChangeSink implements IWorkspaceFileChangeSink {
  private readonly hooks: ILifecycleHookDispatcher;

  constructor(hooks: ILifecycleHookDispatcher) {
    this.hooks = hooks;
  }

  async fileChanged(filePath: string, workspaceRoot: string) {
    await this.hooks.dispatch({
      event: 'FileChanged', workspaceRoot, matchValue: relativeWorkspacePath(filePath, workspaceRoot),
    }).catch(() => undefined);
  }
}

export function relativeWorkspacePath(filePath: string, workspaceRoot: string) {
  const normalizedFile = filePath.replaceAll('\\', '/');
  const normalizedRoot = workspaceRoot.replaceAll('\\', '/').replace(/\/$/, '');
  return normalizedFile.startsWith(`${normalizedRoot}/`)
    ? normalizedFile.slice(normalizedRoot.length + 1)
    : normalizedFile;
}
