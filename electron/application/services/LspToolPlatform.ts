import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import { LSP_TOOL_DEFINITION, LSP_TOOL_NAME } from '../../domain/entities/lsp.js';
import type { ILanguageServerGateway } from '../../domain/ports/ILanguageServerGateway.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import { RunLspOperation } from '../usecases/RunLspOperation.js';
import { parseLspInput } from './lspInput.js';

export class LspToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly gateway: ILanguageServerGateway;
  private readonly runOperation: RunLspOperation;

  constructor(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor, gateway: ILanguageServerGateway) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.gateway = gateway;
    this.runOperation = new RunLspOperation(gateway);
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    let available = false;
    try { available = await this.gateway.isAvailable(workspaceRoot); } catch { available = false; }
    const withoutLsp = tools.filter((tool) => tool.name !== LSP_TOOL_NAME);
    return available ? [...withoutLsp, LSP_TOOL_DEFINITION] : withoutLsp;
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    if (toolName !== LSP_TOOL_NAME) {
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    }
    try {
      const output = await this.runOperation.execute(parseLspInput(args), workspaceRoot, signal);
      return { ok: true, output: output.result };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'LSP operation failed.' };
    }
  }
}
