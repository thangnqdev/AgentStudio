import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { ToolResult, PermissionMode } from '../../domain/entities/agent.js';
import { FileSystemToolExecutor } from './FileSystemToolExecutor.js';
import { runSandboxedCommand } from './sandbox/SandboxedCommandExecutor.js';
import type { WebSearchSettings } from '../../domain/entities/webSearch.js';
import { WebSearchExecutor } from './WebSearchExecutor.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import { LOCAL_TOOL_DEFINITIONS } from './localToolDefinitions.js';

/**
 * Facade implement IToolExecutor — dispatch đến FileSystemToolExecutor hoặc
 * SandboxedCommandExecutor theo tên tool.
 */
export class AgentToolExecutor implements IToolExecutor, IToolCatalog {
  private readonly fs = new FileSystemToolExecutor();
  private readonly webSearch: WebSearchExecutor;
  private readonly skillLoader?: (skillId: string, workspaceRoot: string) => Promise<string>;
  private readonly externalCatalog?: IToolCatalog;
  private readonly externalExecutor?: IToolExecutor;

  constructor(
    webSearchSettings: WebSearchSettings,
    skillLoader?: (skillId: string, workspaceRoot: string) => Promise<string>,
    externalCatalog?: IToolCatalog,
    externalExecutor?: IToolExecutor,
  ) {
    this.webSearch = new WebSearchExecutor(webSearchSettings);
    this.skillLoader = skillLoader;
    this.externalCatalog = externalCatalog;
    this.externalExecutor = externalExecutor;
  }

  async list(workspaceRoot: string) {
    const localTools = this.webSearch.isEnabled()
      ? LOCAL_TOOL_DEFINITIONS
      : LOCAL_TOOL_DEFINITIONS.filter((tool) => tool.name !== 'web_search');
    const externalTools = this.externalCatalog ? await this.externalCatalog.list(workspaceRoot) : [];
    return [...localTools, ...externalTools];
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
  ): Promise<ToolResult> {
    try {
      if (toolName === 'list_files') {
        return await this.fs.listFiles(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'read_file') {
        return await this.fs.readFile(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'write_file') {
        return await this.fs.writeFile(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'apply_patch') {
        return await this.fs.applyPatch(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'run_command') {
        return await this.runCommand(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'web_search') {
        return await this.webSearch.search(args);
      }
      if (toolName === 'load_skill') {
        if (!this.skillLoader) return { ok: false, output: 'Skill infrastructure is unavailable.' };
        const skillId = typeof args.skillId === 'string' ? args.skillId : '';
        if (!skillId) return { ok: false, output: 'skillId is required.' };
        return { ok: true, output: await this.skillLoader(skillId, workspaceRoot) };
      }

      if (this.externalExecutor) return await this.externalExecutor.execute(toolName, args, workspaceRoot, permissionMode);
      return { ok: false, output: `Unknown tool: ${toolName}` };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Unknown tool error' };
    }
  }

  private async runCommand(
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
  ): Promise<ToolResult> {
    if (permissionMode === 'read-only') {
      return { ok: false, output: 'run_command is blocked in read-only mode.' };
    }

    const command = (typeof args.command === 'string' ? args.command : '').trim();
    if (!command) {
      return { ok: false, output: 'Command is empty.' };
    }

    const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || 15_000, 1_000), 30_000);
    return runSandboxedCommand(command, workspaceRoot, permissionMode, timeoutMs);
  }
}
