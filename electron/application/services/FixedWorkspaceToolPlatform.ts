import type { PermissionMode } from '../../domain/entities/agent.js';
import type { IAgentWorkspaceScope } from '../../domain/ports/IAgentWorkspaceScope.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';

export class FixedWorkspaceToolPlatform implements IToolCatalog, IToolExecutor, IAgentWorkspaceScope {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly workspaceRoot: string;

  constructor(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor, workspaceRoot: string) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.workspaceRoot = workspaceRoot;
  }

  list(_workspaceRoot: string) {
    return this.baseCatalog.list(this.workspaceRoot);
  }

  execute(toolName: string, args: Record<string, unknown>, _workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal) {
    return this.baseExecutor.execute(toolName, args, this.workspaceRoot, permissionMode, signal);
  }

  currentRoot() {
    return this.workspaceRoot;
  }
}
