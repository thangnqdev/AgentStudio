import {
  MAX_AGENT_WORK_ITEMS,
  type AgentWorkItem,
} from '../../domain/entities/agentWorkItem.js';
import type { IAgentWorkItemRepository } from '../../domain/ports/IAgentWorkItemRepository.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';
import type { CreateAgentWorkItemInput, UpdateAgentWorkItemInput } from '../services/agentWorkItemInput.js';
import { applyAgentWorkItemUpdate, type AgentWorkItemUpdateResult } from '../services/agentWorkItemMutation.js';

export type AgentWorkItemHookContext = {
  requestId?: string;
  workspaceRoot: string;
  actorName?: string;
  onOwnerChanged?: (item: AgentWorkItem, previousOwner?: string) => void | Promise<void>;
};
export class ManageAgentWorkItems {
  private readonly repository: IAgentWorkItemRepository;
  private readonly hooks?: ILifecycleHookDispatcher;
  private readonly now: () => string;
  private readonly queues = new Map<string, Promise<void>>();

  constructor(repository: IAgentWorkItemRepository, hooks?: ILifecycleHookDispatcher, now = () => new Date().toISOString()) {
    this.repository = repository;
    this.hooks = hooks;
    this.now = now;
  }

  create(taskListId: string, input: CreateAgentWorkItemInput, hookContext: AgentWorkItemHookContext) {
    return this.exclusive(taskListId, async () => {
      const board = structuredClone(await this.repository.load(taskListId));
      if (board.items.length >= MAX_AGENT_WORK_ITEMS) throw new Error(`Task limit exceeded (${MAX_AGENT_WORK_ITEMS}).`);
      const id = String(board.nextId);
      const timestamp = this.now();
      const item: AgentWorkItem = {
        id,
        subject: input.subject,
        description: input.description,
        ...(input.activeForm ? { activeForm: input.activeForm } : {}),
        ...(input.metadata ? { metadata: structuredClone(input.metadata) } : {}),
        owner: undefined,
        status: 'pending',
        blocks: [],
        blockedBy: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.assertHookAllows('TaskCreated', item, hookContext);
      board.nextId += 1;
      board.items.push(item);
      await this.repository.save(taskListId, board);
      return structuredClone(item);
    });
  }

  async get(taskListId: string, taskId: string) {
    await this.waitForMutations(taskListId);
    const item = (await this.repository.load(taskListId)).items.find((candidate) => candidate.id === taskId);
    return item ? structuredClone(item) : null;
  }

  async list(taskListId: string) {
    await this.waitForMutations(taskListId);
    const board = await this.repository.load(taskListId);
    const resolved = new Set(board.items.filter((item) => item.status === 'completed').map((item) => item.id));
    return board.items
      .toSorted((left, right) => Number(left.id) - Number(right.id))
      .map((item) => ({ ...structuredClone(item), blockedBy: item.blockedBy.filter((id) => !resolved.has(id)) }));
  }

  update(taskListId: string, input: UpdateAgentWorkItemInput, hookContext: AgentWorkItemHookContext) {
    return this.exclusive(taskListId, async (): Promise<AgentWorkItemUpdateResult> => {
      const board = structuredClone(await this.repository.load(taskListId));
      const item = board.items.find((candidate) => candidate.id === input.taskId);
      if (!item) return { success: false, taskId: input.taskId, updatedFields: [], error: 'Task not found.' };

      if (input.status === 'completed' && item.status !== 'completed') {
        await this.assertHookAllows('TaskCompleted', item, hookContext);
      }
      const previousOwner = item.owner;
      const effectiveInput = input.status === 'in_progress' && !item.owner && !input.owner && hookContext.actorName
        ? { ...input, owner: hookContext.actorName }
        : input;
      const result = applyAgentWorkItemUpdate(board, effectiveInput, this.now());
      if (result.updatedFields.length > 0) {
        await this.repository.save(taskListId, board);
      }
      if (item.owner && item.owner !== previousOwner) {
        await Promise.resolve(hookContext.onOwnerChanged?.(structuredClone(item), previousOwner)).catch(() => undefined);
      }
      return result;
    });
  }

  clear(taskListId: string) {
    return this.exclusive(taskListId, () => this.repository.delete(taskListId));
  }

  private async assertHookAllows(event: 'TaskCreated' | 'TaskCompleted', item: AgentWorkItem, context: AgentWorkItemHookContext) {
    if (!this.hooks) return;
    let result;
    try {
      result = await this.hooks.dispatch({
        event,
        workspaceRoot: context.workspaceRoot,
        matchValue: item.subject,
        requestId: context.requestId,
        taskId: item.id,
      });
    } catch {
      throw new Error(`${event} lifecycle hooks could not be evaluated.`);
    }
    if (result.taskBlockReason) throw new Error(`Task blocked by lifecycle hook: ${result.taskBlockReason}`);
  }

  private exclusive<T>(taskListId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(taskListId) ?? Promise.resolve();
    const result = previous.then(operation);
    const settled = result.then(() => undefined, () => undefined);
    this.queues.set(taskListId, settled);
    settled.finally(() => { if (this.queues.get(taskListId) === settled) this.queues.delete(taskListId); });
    return result;
  }

  private async waitForMutations(taskListId: string) {
    await this.queues.get(taskListId);
  }
}
