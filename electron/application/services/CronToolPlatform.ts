import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import {
  CRON_CREATE_TOOL_NAME,
  CRON_DELETE_TOOL_NAME,
  CRON_TOOL_DEFINITIONS,
  CRON_TOOL_NAMES,
  type CronOwnerKind,
  type CronScope,
} from '../../domain/entities/cron.js';
import type { ICronTaskRepository } from '../../domain/ports/ICronTaskRepository.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import { cronToHuman } from './cronHumanSchedule.js';
import { parseCronCreateInput, parseCronDeleteInput, parseCronListInput } from './cronInput.js';

export type CronPlatformIdentity = { scopeId: string; ownerId: string; ownerKind: CronOwnerKind };

export class CronToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly repository: ICronTaskRepository;
  private readonly identity: CronPlatformIdentity;
  private readonly now: () => number;
  private readonly observeScope?: (scope: CronScope) => void;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    repository: ICronTaskRepository,
    identity: CronPlatformIdentity,
    now: () => number = Date.now,
    observeScope?: (scope: CronScope) => void,
  ) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.repository = repository;
    this.identity = structuredClone(identity);
    this.now = now;
    this.observeScope = observeScope;
  }

  async list(workspaceRoot: string) {
    this.observeScope?.(this.scope(workspaceRoot));
    const tools = await this.baseCatalog.list(workspaceRoot);
    return [
      ...tools.filter((tool) => !(CRON_TOOL_NAMES as readonly string[]).includes(tool.name)),
      ...CRON_TOOL_DEFINITIONS.map((tool) => structuredClone(tool)),
    ];
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    if (!(CRON_TOOL_NAMES as readonly string[]).includes(toolName)) {
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    }
    if (signal?.aborted) return { ok: false, output: 'Agent session stopped.' };
    const scope = this.scope(workspaceRoot);
    this.observeScope?.(scope);
    try {
      if (toolName === CRON_CREATE_TOOL_NAME) return await this.create(args, scope);
      if (toolName === CRON_DELETE_TOOL_NAME) return await this.remove(args, scope);
      return await this.listJobs(args, scope);
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Cron operation failed.' };
    }
  }

  private async create(args: Record<string, unknown>, scope: CronScope): Promise<ToolResult> {
    const nowMs = this.now();
    const input = parseCronCreateInput(args, nowMs);
    if (input.durable && scope.ownerKind === 'teammate') {
      throw new Error('durable crons are not supported for teammates (teammates do not persist across sessions)');
    }
    const task = await this.repository.create(scope, input, nowMs);
    return jsonResult({
      id: task.id,
      humanSchedule: cronToHuman(task.cron),
      recurring: task.recurring,
      durable: task.durable,
    });
  }

  private async remove(args: Record<string, unknown>, scope: CronScope): Promise<ToolResult> {
    const { id } = parseCronDeleteInput(args);
    if (!(await this.repository.list(scope)).some((task) => task.id === id)) {
      throw new Error(`No scheduled job with id '${id}'`);
    }
    await this.repository.remove(scope, id);
    return jsonResult({ id });
  }

  private async listJobs(args: Record<string, unknown>, scope: CronScope): Promise<ToolResult> {
    parseCronListInput(args);
    const jobs = (await this.repository.list(scope)).map((task) => ({
      id: task.id,
      cron: task.cron,
      humanSchedule: cronToHuman(task.cron),
      prompt: task.prompt,
      ...(task.recurring ? { recurring: true } : {}),
      ...(!task.durable ? { durable: false } : {}),
    }));
    return jsonResult({ jobs });
  }

  private scope(workspaceRoot: string): CronScope {
    return { workspaceRoot, ...this.identity };
  }
}

function jsonResult(value: unknown): ToolResult {
  return { ok: true, output: JSON.stringify(value) };
}
