import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import { WEB_FETCH_TOOL_DEFINITION, WEB_FETCH_TOOL_NAME } from '../../domain/entities/webFetch.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { FetchWebContent } from '../usecases/FetchWebContent.js';
import { parseWebFetchInput } from './webFetchInput.js';

export class WebFetchToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly fetchContent: FetchWebContent;

  constructor(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor, fetchContent: FetchWebContent) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.fetchContent = fetchContent;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    return [...tools.filter((tool) => tool.name !== WEB_FETCH_TOOL_NAME), WEB_FETCH_TOOL_DEFINITION];
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    if (toolName !== WEB_FETCH_TOOL_NAME) {
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    }
    try {
      const output = await this.fetchContent.execute(parseWebFetchInput(args), signal);
      return { ok: true, output: output.result };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'WebFetch failed.' };
    }
  }
}
