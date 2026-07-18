import type { AgentToolDefinition } from './tool.js';

export const CRON_CREATE_TOOL_NAME = 'CronCreate';
export const CRON_DELETE_TOOL_NAME = 'CronDelete';
export const CRON_LIST_TOOL_NAME = 'CronList';
export const CRON_TOOL_NAMES = [CRON_CREATE_TOOL_NAME, CRON_DELETE_TOOL_NAME, CRON_LIST_TOOL_NAME] as const;
export const MAX_CRON_JOBS = 50;
export const CRON_RECURRING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export type CronOwnerKind = 'lead' | 'teammate';
export type CronScope = {
  workspaceRoot: string;
  scopeId: string;
  ownerId: string;
  ownerKind: CronOwnerKind;
};

export type CronTask = {
  id: string;
  cron: string;
  prompt: string;
  createdAt: number;
  lastFiredAt?: number;
  recurring: boolean;
  durable: boolean;
};

export type CreateCronTaskInput = {
  cron: string;
  prompt: string;
  recurring: boolean;
  durable: boolean;
};

export const CRON_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: CRON_CREATE_TOOL_NAME,
    description: 'Schedule a prompt at a future local time, recurring or one-shot. Jobs are session-only unless durable is true.',
    risk: 'write', deferLoading: true, searchHint: 'schedule a recurring or one-shot prompt',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        cron: { type: 'string', description: 'Standard local-time 5-field cron: minute hour day-of-month month day-of-week.' },
        prompt: { type: 'string', description: 'Prompt to enqueue at each fire time.' },
        recurring: { type: 'boolean', default: true, description: 'Fire on every match; false fires once and auto-deletes.' },
        durable: { type: 'boolean', default: false, description: 'Persist across sessions; use only when explicitly requested.' },
      },
      required: ['cron', 'prompt'],
    },
  },
  {
    name: CRON_DELETE_TOOL_NAME,
    description: 'Cancel a scheduled cron job by ID.',
    risk: 'write', deferLoading: true, searchHint: 'cancel a scheduled cron job',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { id: { type: 'string', description: 'Job ID returned by CronCreate.' } },
      required: ['id'],
    },
  },
  {
    name: CRON_LIST_TOOL_NAME,
    description: 'List scheduled cron jobs.',
    risk: 'read', readOnly: true, concurrencySafe: true, deferLoading: true,
    searchHint: 'list active cron jobs',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
  },
];
