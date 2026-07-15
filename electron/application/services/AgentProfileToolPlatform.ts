import type { PermissionMode } from '../../domain/entities/agent.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';

export class AgentProfileToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly allowedTools?: ReadonlySet<string>;

  constructor(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor, allowedTools?: readonly string[]) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.allowedTools = allowedTools ? new Set(allowedTools) : undefined;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    return this.allowedTools ? tools.filter((tool) => this.allowedTools!.has(tool.name)) : tools;
  }

  execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal) {
    if (this.allowedTools && !this.allowedTools.has(toolName)) return Promise.resolve({ ok: false, output: 'Tool is not allowed by this agent profile.' });
    return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
  }
}
