import type { AgentQuestion } from '../../domain/entities/agentInteraction.js';

const MAX_QUESTIONS = 4;
const MAX_OPTIONS = 4;
const MAX_QUESTION_CHARS = 2_000;
const MAX_HEADER_CHARS = 12;
const MAX_LABEL_CHARS = 80;
const MAX_DESCRIPTION_CHARS = 500;
const MAX_PREVIEW_CHARS = 8_000;
const MAX_PLAN_CHARS = 50_000;
const MAX_ALLOWED_PROMPTS = 16;

export function parseAskUserQuestionInput(args: Record<string, unknown>) {
  assertOnlyKeys(args, ['questions']);
  if (!Array.isArray(args.questions) || args.questions.length < 1 || args.questions.length > MAX_QUESTIONS) {
    throw new Error('AskUserQuestion requires 1-4 questions.');
  }
  const questions = args.questions.map(parseQuestion);
  if (new Set(questions.map((item) => item.question)).size !== questions.length) {
    throw new Error('Question texts must be unique.');
  }
  return { questions };
}

export function parseEnterPlanModeInput(args: Record<string, unknown>) {
  assertOnlyKeys(args, []);
  return {};
}

export function parseExitPlanModeInput(args: Record<string, unknown>) {
  assertOnlyKeys(args, ['plan', 'allowedPrompts']);
  const plan = readString(args.plan, 'plan', MAX_PLAN_CHARS).trim();
  if (!plan) throw new Error('ExitPlanMode requires a non-empty plan.');
  const rawPrompts = args.allowedPrompts;
  if (rawPrompts === undefined) return { plan, allowedPrompts: [] as Array<{ tool: 'Bash'; prompt: string }> };
  if (!Array.isArray(rawPrompts) || rawPrompts.length > MAX_ALLOWED_PROMPTS) {
    throw new Error('allowedPrompts must contain at most 16 entries.');
  }
  const allowedPrompts = rawPrompts.map((value) => {
    if (!isObject(value) || value.tool !== 'Bash') throw new Error('Each allowed prompt must target Bash.');
    assertOnlyKeys(value, ['tool', 'prompt']);
    return { tool: 'Bash' as const, prompt: readString(value.prompt, 'allowed prompt', 500) };
  });
  return { plan, allowedPrompts };
}

function parseQuestion(value: unknown): AgentQuestion {
  if (!isObject(value)) throw new Error('Each question must be an object.');
  assertOnlyKeys(value, ['question', 'header', 'options', 'multiSelect']);
  const question = readString(value.question, 'question', MAX_QUESTION_CHARS);
  const header = readString(value.header, 'header', MAX_HEADER_CHARS);
  if (!question.endsWith('?')) throw new Error('Each question must end with a question mark.');
  if (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > MAX_OPTIONS) {
    throw new Error('Each question requires 2-4 options.');
  }
  const options = value.options.map((option) => {
    if (!isObject(option)) throw new Error('Each question option must be an object.');
    assertOnlyKeys(option, ['label', 'description', 'preview']);
    const label = readString(option.label, 'option label', MAX_LABEL_CHARS);
    if (/^(other|khác)$/i.test(label.trim())) throw new Error('Do not include an Other option; the UI adds it automatically.');
    const description = readString(option.description, 'option description', MAX_DESCRIPTION_CHARS);
    const preview = option.preview === undefined ? undefined : readString(option.preview, 'option preview', MAX_PREVIEW_CHARS);
    return { label, description, ...(preview ? { preview } : {}) };
  });
  if (new Set(options.map((option) => option.label)).size !== options.length) {
    throw new Error('Option labels must be unique within each question.');
  }
  if (value.multiSelect !== undefined && typeof value.multiSelect !== 'boolean') {
    throw new Error('multiSelect must be a boolean.');
  }
  return { question, header, options, multiSelect: value.multiSelect === true };
}

function readString(value: unknown, field: string, maximum: number) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0') || value.length > maximum) {
    throw new Error(`${field} must be a non-empty string no longer than ${maximum} characters.`);
  }
  return value;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`Unexpected input properties: ${extras.join(', ')}.`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
