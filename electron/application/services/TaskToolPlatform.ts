import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import type { AgentWorkItem } from '../../domain/entities/agentWorkItem.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { ManageAgentWorkItems } from '../usecases/ManageAgentWorkItems.js';
import {
  assertEmptyTaskInput,
  parseCreateAgentWorkItemInput,
  parseTaskIdInput,
  parseUpdateAgentWorkItemInput,
} from './agentWorkItemInput.js';

export const TASK_TOOL_NAMES = ['task_create', 'task_get', 'task_list', 'task_update'] as const;

const TASK_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: 'task_create',
    description: 'Create a persistent pending task. Call this tool instead of describing task creation whenever the user asks to create, track, or plan work. Check task_list first to avoid duplicates.',
    risk: 'read', deferLoading: true, searchHint: 'create persistent task work item',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        subject: { type: 'string', description: 'Brief actionable task title.' },
        description: { type: 'string', description: 'Detailed completion requirement.' },
        activeForm: { type: 'string', description: 'Present-continuous progress label, such as Running tests.' },
        metadata: { type: 'object', description: 'Optional bounded JSON metadata.' },
      },
      required: ['subject', 'description'],
    },
  },
  {
    name: 'task_get',
    description: 'Get the latest state and dependency graph for one task.',
    risk: 'read', concurrencySafe: true, deferLoading: true, searchHint: 'get task details dependencies',
    parameters: { type: 'object', additionalProperties: false, properties: { taskId: { type: 'string' } }, required: ['taskId'] },
  },
  {
    name: 'task_list',
    description: 'List session tasks and unresolved blockers. Use it before choosing the next task.',
    risk: 'read', concurrencySafe: true, deferLoading: true, searchHint: 'list tasks available work',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'task_update',
    description: 'Persist an update to task details, lifecycle status, owner, metadata, or dependency edges. Call this tool instead of merely saying a task was updated. Complete tasks only after verification passes.',
    risk: 'read', deferLoading: true, searchHint: 'update assign claim complete task dependency',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        taskId: { type: 'string' }, subject: { type: 'string' }, description: { type: 'string' },
        activeForm: { type: 'string' }, owner: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'deleted'] },
        addBlocks: { type: 'array', items: { type: 'string' } },
        addBlockedBy: { type: 'array', items: { type: 'string' } },
        metadata: { type: 'object' },
      },
      required: ['taskId'],
    },
  },
];

export function getTaskToolDefinitions() {
  return TASK_TOOL_DEFINITIONS.map((tool) => structuredClone(tool));
}

export class TaskToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly manager: ManageAgentWorkItems;
  private readonly resolveTaskListId: () => string | Promise<string>;
  private readonly requestId?: string;
  private readonly actorName?: string;
  private readonly onOwnerChanged?: (item: AgentWorkItem, previousOwner?: string) => void | Promise<void>;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    manager: ManageAgentWorkItems,
    context: {
      taskListId: string | (() => string | Promise<string>);
      requestId?: string;
      actorName?: string;
      onOwnerChanged?: (item: AgentWorkItem, previousOwner?: string) => void | Promise<void>;
    },
  ) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.manager = manager;
    this.resolveTaskListId = typeof context.taskListId === 'function' ? context.taskListId : () => context.taskListId as string;
    this.requestId = context.requestId;
    this.actorName = context.actorName;
    this.onOwnerChanged = context.onOwnerChanged;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    return [...tools.filter((tool) => !(TASK_TOOL_NAMES as readonly string[]).includes(tool.name)), ...getTaskToolDefinitions()];
  }

  async execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal): Promise<ToolResult> {
    if (!(TASK_TOOL_NAMES as readonly string[]).includes(toolName)) {
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    }
    if (signal?.aborted) return { ok: false, output: 'Agent session stopped.' };
    try {
      const taskListId = await this.resolveTaskListId();
      const hookContext = {
        workspaceRoot, requestId: this.requestId,
        ...(this.actorName ? { actorName: this.actorName } : {}),
        ...(this.onOwnerChanged ? { onOwnerChanged: this.onOwnerChanged } : {}),
      };
      if (toolName === 'task_create') {
        const item = await this.manager.create(taskListId, parseCreateAgentWorkItemInput(args), hookContext);
        return { ok: true, output: `Task #${item.id} created successfully: ${item.subject}` };
      }
      if (toolName === 'task_get') {
        const item = await this.manager.get(taskListId, parseTaskIdInput(args));
        return { ok: true, output: formatTask(item) };
      }
      if (toolName === 'task_list') {
        assertEmptyTaskInput(args);
        return { ok: true, output: formatTaskList(await this.manager.list(taskListId)) };
      }
      const result = await this.manager.update(taskListId, parseUpdateAgentWorkItemInput(args), hookContext);
      return { ok: true, output: result.success
        ? `Task #${result.taskId} updated successfully${result.updatedFields.length ? `: ${result.updatedFields.join(', ')}` : ' (no changes)'}.`
        : result.error ?? `Task #${result.taskId} not found.` };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Task operation failed.' };
    }
  }
}

function formatTask(item: Awaited<ReturnType<ManageAgentWorkItems['get']>>) {
  if (!item) return 'Task not found.';
  const lines = [`Task #${item.id}: ${item.subject}`, `Status: ${item.status}`, `Description: ${item.description}`];
  if (item.owner) lines.push(`Owner: ${item.owner}`);
  if (item.blockedBy.length) lines.push(`Blocked by: ${item.blockedBy.map((id) => `#${id}`).join(', ')}`);
  if (item.blocks.length) lines.push(`Blocks: ${item.blocks.map((id) => `#${id}`).join(', ')}`);
  return lines.join('\n');
}

function formatTaskList(items: Awaited<ReturnType<ManageAgentWorkItems['list']>>) {
  if (items.length === 0) return 'No tasks found.';
  return items.map((item) => {
    const owner = item.owner ? ` (${item.owner})` : '';
    const blocked = item.blockedBy.length ? ` [blocked by ${item.blockedBy.map((id) => `#${id}`).join(', ')}]` : '';
    return `#${item.id} [${item.status}] ${item.subject}${owner}${blocked}`;
  }).join('\n');
}
