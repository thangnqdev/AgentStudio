import type { ToolResult, PermissionMode } from '../entities/agent.js';

/**
 * Port interface cho tool execution. Application use-case phụ thuộc vào
 * interface này, không tự thực hiện I/O hay spawn process.
 */
export interface IToolExecutor {
  execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
  ): Promise<ToolResult>;
}
