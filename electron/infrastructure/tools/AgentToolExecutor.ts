import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { ToolResult, PermissionMode } from '../../domain/entities/agent.js';
import { FileSystemToolExecutor } from './FileSystemToolExecutor.js';
import { runSandboxedCommand } from './sandbox/SandboxedCommandExecutor.js';
import { OpenAIWebSearchExecutor } from './OpenAIWebSearchExecutor.js';
import type { AgentProviderSettings } from '../../domain/entities/agent.js';

/**
 * Facade implement IToolExecutor — dispatch đến FileSystemToolExecutor hoặc
 * SandboxedCommandExecutor theo tên tool.
 */
export class AgentToolExecutor implements IToolExecutor {
  private readonly fs = new FileSystemToolExecutor();
  private readonly webSearch: OpenAIWebSearchExecutor;

  constructor(settings: AgentProviderSettings) {
    this.webSearch = new OpenAIWebSearchExecutor(settings);
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
      if (toolName === 'run_command') {
        return await this.runCommand(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'web_search') {
        return await this.webSearch.search(args);
      }

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
