import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAgentWorkspaceScope } from '../../domain/ports/IAgentWorkspaceScope.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { ManageAgentWorktrees } from '../usecases/ManageAgentWorktrees.js';
import { parseEnterWorktreeInput, parseExitWorktreeInput } from './agentWorktreeInput.js';
import {
  ENTER_WORKTREE_TOOL_NAME,
  EXIT_WORKTREE_TOOL_NAME,
  getWorktreeToolDefinitions,
  WORKTREE_TOOL_NAMES,
} from './worktreeToolDefinitions.js';

export class WorktreeToolPlatform implements IToolCatalog, IToolExecutor, IAgentWorkspaceScope {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly worktrees: ManageAgentWorktrees;
  private readonly eventSink: IAgentEventSink;
  private readonly scopeId: string;
  private readonly requestId: string;
  private readonly originalWorkspaceRoot: string;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    worktrees: ManageAgentWorktrees,
    eventSink: IAgentEventSink,
    context: { scopeId: string; requestId: string; originalWorkspaceRoot: string },
  ) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.worktrees = worktrees;
    this.eventSink = eventSink;
    this.scopeId = context.scopeId;
    this.requestId = context.requestId;
    this.originalWorkspaceRoot = context.originalWorkspaceRoot;
  }

  currentRoot(fallbackRoot = this.originalWorkspaceRoot) {
    return this.worktrees.currentRoot(this.scopeId, fallbackRoot);
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(this.currentRoot(workspaceRoot));
    const names = WORKTREE_TOOL_NAMES as readonly string[];
    return [...tools.filter((tool) => !names.includes(tool.name)), ...getWorktreeToolDefinitions()];
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    try {
      if (toolName === ENTER_WORKTREE_TOOL_NAME) return await this.enter(args, signal);
      if (toolName === EXIT_WORKTREE_TOOL_NAME) return await this.exit(args, signal);
      return this.baseExecutor.execute(toolName, args, this.currentRoot(workspaceRoot), permissionMode, signal);
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Worktree operation failed.' };
    }
  }

  private async enter(args: Record<string, unknown>, signal?: AbortSignal) {
    throwIfStopped(signal);
    const { name } = parseEnterWorktreeInput(args);
    const session = await this.worktrees.enter(this.scopeId, this.originalWorkspaceRoot, name);
    this.eventSink.emitWorktree?.(this.requestId, this.worktrees.state(this.scopeId));
    return {
      ok: true,
      output: `Created worktree at ${session.worktreePath} on branch ${session.worktreeBranch}. This chat now uses the isolated worktree for all file, command, hook, skill, and subagent operations. Use ExitWorktree only when the user asks to leave it.`,
    };
  }

  private async exit(args: Record<string, unknown>, signal?: AbortSignal) {
    throwIfStopped(signal);
    const input = parseExitWorktreeInput(args);
    const { session, changes, removal } = await this.worktrees.exit(this.scopeId, input);
    this.eventSink.emitWorktree?.(this.requestId, { active: false });
    const changed = changes ? `${changes.changedFiles} changed files and ${changes.commits} commits` : 'unknown changes';
    const message = input.action === 'keep'
      ? `Exited worktree. Preserved ${session.worktreePath} on branch ${session.worktreeBranch} with ${changed}. The chat is back in ${session.originalWorkspaceRoot}.`
      : `Exited and removed worktree ${session.worktreePath}. ${removal?.branchRemoved ? `Removed branch ${session.worktreeBranch}.` : `Branch ${session.worktreeBranch} remains and must be removed manually.`} Discarded ${changed}. The chat is back in ${session.originalWorkspaceRoot}.`;
    return { ok: true, output: message };
  }
}

function throwIfStopped(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('Agent session stopped.');
}
