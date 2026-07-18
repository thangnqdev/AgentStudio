import type { AgentStartPayload } from '../../domain/entities/agent.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { ManageSkills } from './ManageSkills.js';
import type { KnowledgeBaseUseCase } from './KnowledgeBaseUseCase.js';
import type { AgentTaskService } from './AgentTaskService.js';
import type { IOptimizerRepository } from '../../domain/ports/IOptimizerRepository.js';
import type { IProjectInstructionLoader } from '../../domain/ports/IProjectInstructionLoader.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';
import { formatProjectInstructionContext } from '../services/projectInstructionContext.js';
import { formatLifecycleHookContext } from '../services/LifecycleHookDispatcher.js';

type TaskPreparation = Pick<AgentTaskService, 'create' | 'resume' | 'checkpoint'>;
type KnowledgePreparation = Pick<KnowledgeBaseUseCase, 'buildContextDetails'>;
type SkillPreparation = Pick<ManageSkills, 'buildPromptContext'>;
type TuningProvider = Pick<IOptimizerRepository, 'load'>;

export class PrepareAgentSession {
  private readonly tasks: TaskPreparation;
  private readonly knowledge: KnowledgePreparation;
  private readonly skills: SkillPreparation;
  private readonly tracer: IAgentTracer;
  private readonly tuning?: TuningProvider;
  private readonly instructions?: IProjectInstructionLoader;
  private readonly hooks?: ILifecycleHookDispatcher;

  constructor(
    tasks: TaskPreparation,
    knowledge: KnowledgePreparation,
    skills: SkillPreparation,
    tracer: IAgentTracer,
    tuning?: TuningProvider,
    instructions?: IProjectInstructionLoader,
    hooks?: ILifecycleHookDispatcher,
  ) {
    this.tasks = tasks;
    this.knowledge = knowledge;
    this.skills = skills;
    this.tracer = tracer;
    this.tuning = tuning;
    this.instructions = instructions;
    this.hooks = hooks;
  }

  async execute(input: { payload: AgentStartPayload; taskId: string; requestId: string; workspaceRoot: string; runtimeWorkspaceRoot?: string }) {
    const tuning = (await this.tuning?.load())?.active;
    const runtimeWorkspaceRoot = input.runtimeWorkspaceRoot ?? input.workspaceRoot;
    const projectInstructionContext = formatProjectInstructionContext(
      await this.instructions?.load(runtimeWorkspaceRoot) ?? [],
    );
    let task;
    if (input.taskId) {
      task = await this.tasks.resume(input.taskId, input.workspaceRoot);
    } else {
      const userMessages = (input.payload.messages ?? []).filter((message) => message.sender === 'user' && typeof message.content === 'string');
      const latest = userMessages.at(-1);
      task = await this.tasks.create(input.payload, input.workspaceRoot, '');
      if (latest?.content) {
        const startedAt = new Date().toISOString();
        try {
          const retrieval = await this.knowledge.buildContextDetails(runtimeWorkspaceRoot, latest.content, userMessages.slice(-3, -1).map((message) => message.content).join('\n'), tuning);
          await this.tracer.recordSpan({ kind: 'retrieval', traceId: task.traceId, taskId: task.id, requestId: input.requestId, step: 0, startedAt, endedAt: new Date().toISOString(), status: 'succeeded', mode: retrieval.mode, resultCount: retrieval.resultCount }).catch(() => undefined);
          task = { ...task, knowledgeContext: retrieval.context };
          await this.tasks.checkpoint(task);
        } catch (error) {
          await this.tracer.recordSpan({ kind: 'retrieval', traceId: task.traceId, taskId: task.id, requestId: input.requestId, step: 0, startedAt, endedAt: new Date().toISOString(), status: 'failed', mode: 'unavailable', resultCount: 0 }).catch(() => undefined);
          throw error;
        }
      }
    }
    const userMessages = task.messages.filter((message) => message.sender === 'user' && typeof message.content === 'string');
    const question = userMessages.at(-1)?.content || '';
    const skillContext = question ? await this.skills.buildPromptContext(runtimeWorkspaceRoot, question, tuning?.skillRankingWeight) : '';
    await this.hooks?.dispatch({
      event: 'InstructionsLoaded', workspaceRoot: runtimeWorkspaceRoot, requestId: input.requestId, taskId: task.id,
    }).catch(() => undefined);
    const sessionHooks = await this.hooks?.dispatch({
      event: 'SessionStart', workspaceRoot: runtimeWorkspaceRoot, requestId: input.requestId,
    });
    const promptHooks = question ? await this.hooks?.dispatch({
      event: 'UserPromptSubmit', workspaceRoot: runtimeWorkspaceRoot, requestId: input.requestId,
    }) : undefined;
    const lifecycleHookContext = [
      formatLifecycleHookContext('SessionStart', sessionHooks?.contexts ?? []),
      formatLifecycleHookContext('UserPromptSubmit', promptHooks?.contexts ?? []),
    ].filter(Boolean).join('\n\n');
    return { task, skillContext, projectInstructionContext, lifecycleHookContext };
  }
}
