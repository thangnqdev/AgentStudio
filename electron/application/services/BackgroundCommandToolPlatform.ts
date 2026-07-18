import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { BackgroundCommandSnapshot } from '../../domain/entities/backgroundCommand.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { ManageBackgroundCommands } from '../usecases/ManageBackgroundCommands.js';
import type { ManageAgentWorkers } from '../usecases/ManageAgentWorkers.js';
import {
  parseBackgroundCommandOutput,
  parseBackgroundCommandStart,
  parseBackgroundCommandTaskId,
  wantsBackgroundCommand,
} from './backgroundCommandInput.js';
import { BACKGROUND_TASK_TOOL_DEFINITIONS, BACKGROUND_TASK_TOOL_NAMES, TASK_OUTPUT_TOOL_NAMES, TASK_STOP_TOOL_NAMES } from './backgroundTaskToolDefinitions.js';
import { UnifiedBackgroundTaskService, type UnifiedTaskOutput } from './UnifiedBackgroundTaskService.js';

export const BACKGROUND_COMMAND_TOOL_NAMES = BACKGROUND_TASK_TOOL_NAMES;

export function getBackgroundCommandToolDefinitions() {
  return BACKGROUND_TASK_TOOL_DEFINITIONS.map((tool) => structuredClone(tool));
}

export class BackgroundCommandToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly commands: ManageBackgroundCommands;
  private readonly tasks: UnifiedBackgroundTaskService;
  private readonly scopeId: string;
  private readonly agentScopeId: string;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    manager: ManageBackgroundCommands,
    scopeId: string,
    workers?: ManageAgentWorkers,
    agentScopeId = scopeId,
  ) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.commands = manager;
    this.tasks = new UnifiedBackgroundTaskService(manager, workers);
    this.scopeId = scopeId;
    this.agentScopeId = agentScopeId;
  }

  async list(workspaceRoot: string) {
    const tools = (await this.baseCatalog.list(workspaceRoot)).map(addBackgroundOption);
    return [
      ...tools.filter((tool) => !(BACKGROUND_COMMAND_TOOL_NAMES as readonly string[]).includes(tool.name)),
      ...getBackgroundCommandToolDefinitions(),
    ];
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    try {
      if (toolName === 'run_command' && wantsBackgroundCommand(args)) {
        if (signal?.aborted) return { ok: false, output: 'Agent session stopped.' };
        const task = await this.commands.start(this.scopeId, parseBackgroundCommandStart(args), { workspaceRoot, permissionMode });
        return { ok: true, output: formatStartedTask(task) };
      }
      if ((TASK_OUTPUT_TOOL_NAMES as readonly string[]).includes(toolName)) {
        return { ok: true, output: formatTaskOutput(await this.tasks.output(this.scopeId, this.agentScopeId, parseBackgroundCommandOutput(args), signal)) };
      }
      if ((TASK_STOP_TOOL_NAMES as readonly string[]).includes(toolName)) {
        return { ok: true, output: formatStoppedTask(await this.tasks.stop(this.scopeId, this.agentScopeId, parseBackgroundCommandTaskId(args))) };
      }
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Background command operation failed.' };
    }
  }
}

function addBackgroundOption(tool: AgentToolDefinition): AgentToolDefinition {
  if (tool.name !== 'run_command') return tool;
  const parameters = tool.parameters as { properties?: Record<string, unknown> };
  return {
    ...tool,
    description: 'Run a shell command in the workspace. For long work, set run_in_background=true and use TaskOutput or TaskStop with the returned ID.',
    parameters: {
      ...parameters,
      properties: {
        ...parameters.properties,
        description: { type: 'string', description: 'Concise description of the command purpose.' },
        run_in_background: { type: 'boolean', description: 'Return immediately while the command continues in the background.' },
        runInBackground: { type: 'boolean', description: 'Compatibility alias for run_in_background.' },
      },
    },
  };
}

function formatStartedTask(task: BackgroundCommandSnapshot) {
  return [
    '<background_task_started>',
    `<task_id>${task.id}</task_id>`,
    `<status>${task.status}</status>`,
    `<description>${escapeXml(task.description)}</description>`,
    '</background_task_started>',
    `Use TaskOutput with task_id "${task.id}" to retrieve output, or TaskStop to stop it.`,
  ].join('\n');
}

function formatTaskOutput(output: UnifiedTaskOutput) {
  if (output.taskType === 'local_agent') return formatAgentTaskOutput(output.retrievalStatus, output.task);
  const { task } = output.result;
  const lines = [
    `<retrieval_status>${output.result.retrievalStatus}</retrieval_status>`,
    `<task_id>${task.id}</task_id>`,
    '<task_type>local_bash</task_type>',
    `<status>${task.status}</status>`,
  ];
  if (task.exitCode !== null) lines.push(`<exit_code>${task.exitCode}</exit_code>`);
  if (task.error) lines.push(`<error>${escapeXml(task.error)}</error>`);
  if (output.result.output) lines.push(`<output>\n${output.result.output.trimEnd()}\n</output>`);
  return lines.join('\n\n');
}

function formatAgentTaskOutput(retrievalStatus: string, task: AgentWorkerRecord) {
  const lines = [
    `<retrieval_status>${retrievalStatus}</retrieval_status>`, `<task_id>${task.id}</task_id>`,
    '<task_type>local_agent</task_type>', `<status>${task.status}</status>`,
  ];
  const output = task.result || (task.status === 'running' ? '' : task.error || '');
  if (output) lines.push(`<output>\n${output.trimEnd()}\n</output>`);
  if (task.error) lines.push(`<error>${escapeXml(task.error)}</error>`);
  return lines.join('\n\n');
}

function formatStoppedTask(result: Awaited<ReturnType<UnifiedBackgroundTaskService['stop']>>) {
  const task = result.taskType === 'local_agent' ? result : result.task;
  const id = result.taskType === 'local_agent' ? result.id : task.id;
  const description = result.taskType === 'local_agent' ? result.description : task.description;
  return JSON.stringify({ message: `Successfully stopped task: ${id} (${description})`, task_id: id, task_type: result.taskType, command: description });
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
