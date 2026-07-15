import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import type { BackgroundCommandOutput, BackgroundCommandSnapshot } from '../../domain/entities/backgroundCommand.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { ManageBackgroundCommands } from '../usecases/ManageBackgroundCommands.js';
import {
  parseBackgroundCommandOutput,
  parseBackgroundCommandStart,
  parseBackgroundCommandTaskId,
  wantsBackgroundCommand,
} from './backgroundCommandInput.js';

export const BACKGROUND_COMMAND_TOOL_NAMES = ['task_output', 'task_stop'] as const;

const BACKGROUND_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: 'task_output',
    description: 'Read status and bounded output from a background command. Set block=true to wait for completion.',
    risk: 'read', concurrencySafe: true, deferLoading: true, searchHint: 'read wait background command output',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        task_id: { type: 'string', description: 'Background task ID returned by run_command.' },
        taskId: { type: 'string', description: 'Compatibility alias for task_id.' },
        block: { type: 'boolean', description: 'Wait for completion; defaults to true.' },
        timeoutMs: { type: 'integer', description: 'Maximum wait in milliseconds, from 0 to 600000.' },
      },
    },
  },
  {
    name: 'task_stop',
    description: 'Stop one running background command by task ID.',
    risk: 'execute', deferLoading: true, searchHint: 'stop background command task',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        task_id: { type: 'string', description: 'Background task ID returned by run_command.' },
        taskId: { type: 'string', description: 'Compatibility alias for task_id.' },
      },
    },
  },
];

export function getBackgroundCommandToolDefinitions() {
  return BACKGROUND_TOOL_DEFINITIONS.map((tool) => structuredClone(tool));
}

export class BackgroundCommandToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly manager: ManageBackgroundCommands;
  private readonly scopeId: string;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    manager: ManageBackgroundCommands,
    scopeId: string,
  ) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.manager = manager;
    this.scopeId = scopeId;
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
        const task = await this.manager.start(this.scopeId, parseBackgroundCommandStart(args), { workspaceRoot, permissionMode });
        return { ok: true, output: formatStartedTask(task) };
      }
      if (toolName === 'task_output') {
        return { ok: true, output: formatTaskOutput(await this.manager.output(this.scopeId, parseBackgroundCommandOutput(args), signal)) };
      }
      if (toolName === 'task_stop') {
        return { ok: true, output: formatStoppedTask(await this.manager.stop(this.scopeId, parseBackgroundCommandTaskId(args))) };
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
    description: 'Run a shell command in the workspace. For long work, set run_in_background=true and use task_output or task_stop with the returned ID.',
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
    `Use task_output with task_id "${task.id}" to retrieve output, or task_stop to stop it.`,
  ].join('\n');
}

function formatTaskOutput(result: BackgroundCommandOutput) {
  const task = result.task;
  const lines = [
    `<retrieval_status>${result.retrievalStatus}</retrieval_status>`,
    `<task_id>${task.id}</task_id>`,
    `<status>${task.status}</status>`,
  ];
  if (task.exitCode !== null) lines.push(`<exit_code>${task.exitCode}</exit_code>`);
  if (task.error) lines.push(`<error>${escapeXml(task.error)}</error>`);
  if (result.output) lines.push(`<output>\n${result.output.trimEnd()}\n</output>`);
  return lines.join('\n\n');
}

function formatStoppedTask(task: BackgroundCommandSnapshot) {
  return `Successfully stopped background task ${task.id}: ${task.description}`;
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
