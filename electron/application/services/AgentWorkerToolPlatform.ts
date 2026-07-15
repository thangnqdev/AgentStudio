import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import {
  AGENT_WORKER_TOOL_DEFINITION,
  AGENT_WORKER_TOOL_NAME,
  SEND_MESSAGE_TOOL_DEFINITION,
  SEND_MESSAGE_TOOL_NAME,
} from '../../domain/entities/agentWorker.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type {
  AgentWorkerExecution,
  AgentWorkerParentContext,
  ManageAgentWorkers,
} from '../usecases/ManageAgentWorkers.js';
import { parseAgentWorkerSpawnRequest, parseSendMessageRequest } from './agentWorkerInput.js';

const TOOL_NAMES = [AGENT_WORKER_TOOL_NAME, SEND_MESSAGE_TOOL_NAME] as const;

export class AgentWorkerToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly workers: ManageAgentWorkers;
  private readonly execution: AgentWorkerExecution;
  private readonly context: Omit<AgentWorkerParentContext, 'workspaceRoot' | 'permissionMode'>;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    workers: ManageAgentWorkers,
    execution: AgentWorkerExecution,
    context: Omit<AgentWorkerParentContext, 'workspaceRoot' | 'permissionMode'>,
  ) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.workers = workers;
    this.execution = execution;
    this.context = context;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    return [
      ...tools.filter((tool) => !(TOOL_NAMES as readonly string[]).includes(tool.name)),
      structuredClone(AGENT_WORKER_TOOL_DEFINITION),
      structuredClone(SEND_MESSAGE_TOOL_DEFINITION),
    ];
  }

  async execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal): Promise<ToolResult> {
    if (!(TOOL_NAMES as readonly string[]).includes(toolName)) {
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    }
    if (signal?.aborted) return { ok: false, output: 'Agent session stopped.' };
    const parent: AgentWorkerParentContext = { ...this.context, workspaceRoot, permissionMode };
    try {
      if (toolName === AGENT_WORKER_TOOL_NAME) {
        const request = parseAgentWorkerSpawnRequest(args);
        if (this.context.parentAgentId && request.runInBackground) {
          throw new Error('Nested agents must run synchronously. Background workers cannot spawn background agents.');
        }
        const launched = await this.workers.spawn(request, parent, this.execution);
        if (launched.background) {
          return { ok: true, output: JSON.stringify({ status: 'async_launched', agentId: launched.worker.id, name: launched.worker.name, description: launched.worker.description }) };
        }
        const worker = launched.worker;
        return {
          ok: worker.status === 'completed' || worker.status === 'paused',
          output: JSON.stringify({
            status: worker.status, agentId: worker.id, name: worker.name, result: worker.result || worker.error || '',
            completedSteps: worker.completedSteps, worktreePath: worker.worktreePath, worktreeBranch: worker.worktreeBranch,
          }),
        };
      }
      const outcomes = await this.workers.send(parseSendMessageRequest(args), parent, this.execution);
      return { ok: true, output: outcomes.join('\n') };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Agent worker operation failed.' };
    }
  }
}
