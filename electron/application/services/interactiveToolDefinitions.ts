import type { AgentToolDefinition } from '../../domain/entities/tool.js';

export const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion';
export const ENTER_PLAN_MODE_TOOL_NAME = 'EnterPlanMode';
export const EXIT_PLAN_MODE_TOOL_NAME = 'ExitPlanMode';
export const INTERACTIVE_TOOL_NAMES = [
  ASK_USER_QUESTION_TOOL_NAME,
  ENTER_PLAN_MODE_TOOL_NAME,
  EXIT_PLAN_MODE_TOOL_NAME,
] as const;

const QUESTION_OPTION_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    label: { type: 'string', description: 'Concise 1-5 word option label.' },
    description: { type: 'string', description: 'Trade-off or impact of selecting the option.' },
    preview: { type: 'string', description: 'Optional Markdown preview for a concrete artifact or approach.' },
  },
  required: ['label', 'description'],
};

const TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: ASK_USER_QUESTION_TOOL_NAME,
    description: 'Ask the local user 1-4 structured questions when a material choice or missing requirement blocks progress. Supports single-select, multi-select, Markdown previews, notes, and an automatic Other response. Do not use it for plan approval; use ExitPlanMode.',
    risk: 'read', deferLoading: true, searchHint: 'ask user structured clarification questions',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        questions: {
          type: 'array', minItems: 1, maxItems: 4,
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              question: { type: 'string', description: 'Clear complete question ending in a question mark.' },
              header: { type: 'string', description: 'Very short chip label, at most 12 characters.' },
              options: { type: 'array', minItems: 2, maxItems: 4, items: QUESTION_OPTION_SCHEMA },
              multiSelect: { type: 'boolean', description: 'Allow more than one answer.' },
            },
            required: ['question', 'header', 'options'],
          },
        },
      },
      required: ['questions'],
    },
  },
  {
    name: ENTER_PLAN_MODE_TOOL_NAME,
    description: 'Request consent to enter a read-only exploration and planning phase before a genuinely ambiguous or high-impact implementation.',
    risk: 'read', deferLoading: true, searchHint: 'enter planning mode read only exploration',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: EXIT_PLAN_MODE_TOOL_NAME,
    description: 'Present the completed implementation plan for explicit user approval. Use only while plan mode is active; after approval the normal permission mode is restored and implementation may begin.',
    risk: 'read', deferLoading: true, searchHint: 'exit plan request plan approval',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        plan: { type: 'string', description: 'Complete Markdown implementation plan shown to the user.' },
        allowedPrompts: {
          type: 'array', maxItems: 16,
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              tool: { type: 'string', enum: ['Bash'] },
              prompt: { type: 'string', description: 'Semantic command category such as run tests.' },
            },
            required: ['tool', 'prompt'],
          },
        },
      },
      required: ['plan'],
    },
  },
];

export function getInteractiveToolDefinitions() {
  return TOOL_DEFINITIONS.map((tool) => structuredClone(tool));
}
