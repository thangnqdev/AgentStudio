import type { AgentInteractionRequest, AgentInteractionResponse, AgentQuestion } from '../../domain/entities/agentInteraction.js';
import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { IUserInteractionGateway } from '../../domain/ports/IUserInteractionGateway.js';
import type { ManageAgentPlanMode } from '../usecases/ManageAgentPlanMode.js';
import { parseAskUserQuestionInput, parseEnterPlanModeInput, parseExitPlanModeInput } from './agentInteractionInput.js';
import {
  ASK_USER_QUESTION_TOOL_NAME,
  ENTER_PLAN_MODE_TOOL_NAME,
  getInteractiveToolDefinitions,
  INTERACTIVE_TOOL_NAMES,
} from './interactiveToolDefinitions.js';

export class InteractiveToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly plans: ManageAgentPlanMode;
  private readonly interactions: IUserInteractionGateway;
  private readonly eventSink: IAgentEventSink;
  private readonly context: { scopeId: string; requestId: string };
  private readonly idFactory: () => string;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    plans: ManageAgentPlanMode,
    interactions: IUserInteractionGateway,
    eventSink: IAgentEventSink,
    context: { scopeId: string; requestId: string },
    idFactory: () => string = () => `interaction-${crypto.randomUUID()}`,
  ) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.plans = plans;
    this.interactions = interactions;
    this.eventSink = eventSink;
    this.context = context;
    this.idFactory = idFactory;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    const names = INTERACTIVE_TOOL_NAMES as readonly string[];
    return [...tools.filter((tool) => !names.includes(tool.name)), ...getInteractiveToolDefinitions()];
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    if (!(INTERACTIVE_TOOL_NAMES as readonly string[]).includes(toolName)) {
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    }
    try {
      if (toolName === ASK_USER_QUESTION_TOOL_NAME) return await this.askQuestions(args, signal);
      if (toolName === ENTER_PLAN_MODE_TOOL_NAME) return await this.enterPlanMode(args, signal);
      return await this.exitPlanMode(args, signal);
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Interactive tool failed.' };
    }
  }

  private async askQuestions(args: Record<string, unknown>, signal?: AbortSignal) {
    const { questions } = parseAskUserQuestionInput(args);
    const response = await this.request({ kind: 'questions', title: 'Agent cần bạn quyết định', questions }, signal);
    if (!response.accepted) return { ok: false, output: 'User declined to answer the questions.' };
    const { answers, annotations } = validateQuestionResponse(questions, response);
    const details = Object.entries(answers).map(([question, answer]) => `"${question}"="${answer}"`).join(', ');
    const context = formatAnnotations(annotations);
    return { ok: true, output: `User has answered your questions: ${details}.${context} Continue with these answers in mind.` };
  }

  private async enterPlanMode(args: Record<string, unknown>, signal?: AbortSignal) {
    parseEnterPlanModeInput(args);
    if (this.plans.isActive(this.context.scopeId)) {
      this.eventSink.emitPlanMode?.(this.context.requestId, { active: true });
      return { ok: true, output: planModeInstructions('Plan mode is already active.') };
    }
    const response = await this.request({ kind: 'plan_enter', title: 'Vào Plan Mode?' }, signal);
    if (!response.accepted) return { ok: false, output: 'User declined to enter plan mode. Continue without plan mode.' };
    this.plans.enter(this.context.scopeId);
    this.eventSink.emitPlanMode?.(this.context.requestId, { active: true });
    return { ok: true, output: planModeInstructions('Entered plan mode.') };
  }

  private async exitPlanMode(args: Record<string, unknown>, signal?: AbortSignal) {
    if (!this.plans.isActive(this.context.scopeId)) {
      return { ok: false, output: 'ExitPlanMode can only be used while plan mode is active.' };
    }
    const { plan, allowedPrompts } = parseExitPlanModeInput(args);
    const response = await this.request({ kind: 'plan_exit', title: 'Duyệt kế hoạch triển khai', plan }, signal);
    if (!response.accepted) return { ok: false, output: 'User rejected the plan. Remain in plan mode, incorporate the feedback, and present a revised plan.' };
    const snapshot = await this.plans.approve(this.context.scopeId, plan);
    this.eventSink.emitPlanMode?.(this.context.requestId, { active: false });
    const promptSummary = allowedPrompts.length
      ? `\nApproved semantic Bash categories: ${allowedPrompts.map((item) => item.prompt).join('; ')}.`
      : '';
    return {
      ok: true,
      output: `User approved the plan. Plan mode is closed; implementation may begin. Saved plan reference: ${snapshot.planReference}.${promptSummary}\n\n## Approved Plan\n${plan}`,
    };
  }

  private async request(input: Omit<AgentInteractionRequest, 'id'>, signal?: AbortSignal) {
    if (!this.eventSink.emitInteraction) throw new Error('Structured user interaction is unavailable.');
    const id = this.idFactory();
    const pending = this.interactions.waitForResponse(this.context.requestId, id, signal);
    this.eventSink.emitInteraction(this.context.requestId, { id, ...input });
    return pending;
  }
}

function validateQuestionResponse(questions: AgentQuestion[], response: AgentInteractionResponse) {
  const answers = response.answers ?? {};
  const annotations = response.annotations ?? {};
  const expected = new Set(questions.map((question) => question.question));
  if (Object.keys(answers).some((question) => !expected.has(question))) throw new Error('Interaction response contains an unknown question.');
  if (Object.keys(annotations).some((question) => !expected.has(question))) throw new Error('Interaction response contains an annotation for an unknown question.');
  for (const question of questions) {
    const answer = answers[question.question];
    if (typeof answer !== 'string' || !answer.trim() || answer.length > 2_000) {
      throw new Error(`A valid answer is required for: ${question.question}`);
    }
  }
  return { answers, annotations };
}

function formatAnnotations(annotations: NonNullable<AgentInteractionResponse['annotations']>) {
  const items = Object.entries(annotations).flatMap(([question, annotation]) => {
    const values = [
      annotation.preview ? `selected preview: ${annotation.preview}` : '',
      annotation.notes ? `user notes: ${annotation.notes}` : '',
    ].filter(Boolean);
    return values.length ? [`\n- ${question}: ${values.join('; ')}`] : [];
  });
  return items.length ? `\nAdditional response context:${items.join('')}.` : '';
}

function planModeInstructions(prefix: string) {
  return `${prefix}\nPlan mode is read-only: thoroughly explore the codebase, identify existing patterns, compare approaches, and use AskUserQuestion for material ambiguity. Do not write files or run commands that change state. When ready, call ExitPlanMode with a concrete Markdown plan for user approval.`;
}
