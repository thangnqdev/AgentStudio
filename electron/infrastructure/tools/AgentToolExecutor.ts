import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { ToolResult, PermissionMode } from '../../domain/entities/agent.js';
import { FileSystemToolExecutor } from './FileSystemToolExecutor.js';
import { runSandboxedCommand } from './sandbox/SandboxedCommandExecutor.js';
import type { WebSearchSettings } from '../../domain/entities/webSearch.js';
import { WebSearchExecutor } from './WebSearchExecutor.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolPlatformDecorator } from '../../domain/ports/IToolPlatformDecorator.js';
import { LOCAL_TOOL_DEFINITIONS } from './localToolDefinitions.js';
import { WorkspaceSearchToolExecutor } from './WorkspaceSearchToolExecutor.js';
import type { IWorkspaceFileChangeSink } from '../../domain/ports/IWorkspaceFileChangeSink.js';
import type { CommandShell } from '../../domain/entities/backgroundCommand.js';

/**
 * Facade implement IToolExecutor — dispatch đến FileSystemToolExecutor hoặc
 * SandboxedCommandExecutor theo tên tool.
 */
export class AgentToolExecutor implements IToolExecutor, IToolCatalog {
  private readonly fs: FileSystemToolExecutor;
  private readonly searchTools = new WorkspaceSearchToolExecutor();
  private readonly webSearch: WebSearchExecutor;
  private readonly skillLoader?: (skillId: string, workspaceRoot: string) => Promise<string>;
  private readonly externalCatalog?: IToolCatalog & Partial<IToolPlatformDecorator>;
  private readonly externalExecutor?: IToolExecutor & Partial<IToolPlatformDecorator>;
  private readonly defaultTimeoutMs: number;

  constructor(
    webSearchSettings: WebSearchSettings,
    skillLoader?: (skillId: string, workspaceRoot: string) => Promise<string>,
    externalCatalog?: IToolCatalog & Partial<IToolPlatformDecorator>,
    externalExecutor?: IToolExecutor & Partial<IToolPlatformDecorator>,
    defaultTimeoutMs = 15_000,
    fileChanges?: IWorkspaceFileChangeSink,
  ) {
    this.fs = new FileSystemToolExecutor(fileChanges);
    this.webSearch = new WebSearchExecutor(webSearchSettings);
    this.skillLoader = skillLoader;
    this.externalCatalog = externalCatalog;
    this.externalExecutor = externalExecutor;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  async list(workspaceRoot: string) {
    const localTools = this.webSearch.isEnabled()
      ? LOCAL_TOOL_DEFINITIONS
      : LOCAL_TOOL_DEFINITIONS.filter((tool) => tool.name !== 'web_search');
    const externalTools = this.externalCatalog ? await this.externalCatalog.list(workspaceRoot) : [];
    const tools = [...localTools, ...externalTools];
    return this.externalCatalog?.decorateTools?.(tools) ?? tools;
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    try {
      if (this.externalExecutor?.interceptsTool?.(toolName, args)) {
        return await this.externalExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
      }
      if (toolName === 'list_files') {
        return await this.fs.listFiles(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'read_file') {
        return await this.fs.readFile(args, workspaceRoot, permissionMode, signal);
      }
      if (toolName === 'glob') {
        return await this.searchTools.glob(args, workspaceRoot, permissionMode, signal);
      }
      if (toolName === 'grep') {
        return await this.searchTools.grep(args, workspaceRoot, permissionMode, signal);
      }
      if (toolName === 'write_file') {
        return await this.fs.writeFile(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'apply_patch') {
        return await this.fs.applyPatch(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'run_command') {
        return await this.runCommand(args, workspaceRoot, permissionMode, signal);
      }
      if (toolName === 'web_search') {
        return await this.webSearch.search(args, signal);
      }
      if (toolName === 'load_skill') {
        if (!this.skillLoader) return { ok: false, output: 'Skill infrastructure is unavailable.' };
        const skillId = typeof args.skillId === 'string' ? args.skillId : '';
        if (!skillId) return { ok: false, output: 'skillId is required.' };
        const loaded = await this.skillLoader(skillId, workspaceRoot);
        const skillArgs = typeof args.args === 'string' ? args.args.slice(0, 20_000) : '';
        return { ok: true, output: skillArgs ? `${loaded}\n<skill-arguments>${escapeXml(skillArgs)}</skill-arguments>` : loaded };
      }

      if (this.externalExecutor) return await this.externalExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
      return { ok: false, output: `Unknown tool: ${toolName}` };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Unknown tool error' };
    }
  }

  private async runCommand(
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    if (permissionMode === 'read-only') {
      return { ok: false, output: 'run_command is blocked in read-only mode.' };
    }

    const command = (typeof args.command === 'string' ? args.command : '').trim();
    if (!command) {
      return { ok: false, output: 'Command is empty.' };
    }

    const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || this.defaultTimeoutMs, 1_000), 600_000);
    const shell: CommandShell | undefined = args.shell === 'powershell' ? 'powershell' : undefined;
    return runSandboxedCommand(command, workspaceRoot, permissionMode, timeoutMs, signal, shell);
  }
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
