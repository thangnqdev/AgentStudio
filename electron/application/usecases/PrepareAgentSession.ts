import type { AgentStartPayload } from '../../domain/entities/agent.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { ManageSkills } from './ManageSkills.js';
import type { KnowledgeBaseUseCase } from './KnowledgeBaseUseCase.js';
import type { AgentTaskService } from './AgentTaskService.js';

type TaskPreparation = Pick<AgentTaskService, 'create' | 'resume' | 'checkpoint'>;
type KnowledgePreparation = Pick<KnowledgeBaseUseCase, 'buildContextDetails'>;
type SkillPreparation = Pick<ManageSkills, 'buildPromptContext'>;

export class PrepareAgentSession {
  private readonly tasks: TaskPreparation;
  private readonly knowledge: KnowledgePreparation;
  private readonly skills: SkillPreparation;
  private readonly tracer: IAgentTracer;

  constructor(
    tasks: TaskPreparation,
    knowledge: KnowledgePreparation,
    skills: SkillPreparation,
    tracer: IAgentTracer,
  ) {
    this.tasks = tasks;
    this.knowledge = knowledge;
    this.skills = skills;
    this.tracer = tracer;
  }

  async execute(input: { payload: AgentStartPayload; taskId: string; requestId: string; workspaceRoot: string }) {
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
          const retrieval = await this.knowledge.buildContextDetails(input.workspaceRoot, latest.content, userMessages.slice(-3, -1).map((message) => message.content).join('\n'));
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
    const skillContext = question ? await this.skills.buildPromptContext(input.workspaceRoot, question) : '';
    return { task, skillContext };
  }
}
