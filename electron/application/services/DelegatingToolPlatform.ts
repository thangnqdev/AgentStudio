import type { PermissionMode } from '../../domain/entities/agent.js';
import { parseSubagentRequest, SUBAGENT_TOOL_DEFINITION, SUBAGENT_TOOL_NAME } from '../../domain/entities/subagent.js';
import type { ISubagentRunner } from '../../domain/ports/ISubagentRunner.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';

export class DelegatingToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly subagent: ISubagentRunner;

  constructor(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor, subagent: ISubagentRunner) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.subagent = subagent;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    return [...tools.filter((tool) => tool.name !== SUBAGENT_TOOL_NAME), SUBAGENT_TOOL_DEFINITION];
  }

  async execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode) {
    if (toolName !== SUBAGENT_TOOL_NAME) return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode);
    let request;
    try {
      request = parseSubagentRequest(args);
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Subagent request is invalid.' };
    }
    try {
      const result = await this.subagent.run({ ...request, workspaceRoot });
      return { ok: true, output: JSON.stringify(result) };
    } catch {
      return { ok: false, output: 'The read-only subagent failed before producing a result.' };
    }
  }
}
