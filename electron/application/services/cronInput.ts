import type { CreateCronTaskInput } from '../../domain/entities/cron.js';
import { nextCronFireAt, parseCronExpression } from '../../domain/entities/cronSchedule.js';

const CREATE_FIELDS = new Set(['cron', 'prompt', 'recurring', 'durable']);

export function parseCronCreateInput(args: Record<string, unknown>, nowMs: number): CreateCronTaskInput {
  rejectUnknown(args, CREATE_FIELDS, 'CronCreate');
  if (typeof args.cron !== 'string' || typeof args.prompt !== 'string') {
    throw new Error('CronCreate requires string fields cron and prompt.');
  }
  if (args.recurring !== undefined && typeof args.recurring !== 'boolean') {
    throw new Error('CronCreate recurring must be a boolean.');
  }
  if (args.durable !== undefined && typeof args.durable !== 'boolean') {
    throw new Error('CronCreate durable must be a boolean.');
  }
  if (!parseCronExpression(args.cron)) {
    throw new Error(`Invalid cron expression '${args.cron}'. Expected 5 fields: M H DoM Mon DoW.`);
  }
  if (nextCronFireAt(args.cron, nowMs) === null) {
    throw new Error(`Cron expression '${args.cron}' does not match any calendar date in the next year.`);
  }
  return {
    cron: args.cron,
    prompt: args.prompt,
    recurring: args.recurring ?? true,
    durable: args.durable ?? false,
  };
}

export function parseCronDeleteInput(args: Record<string, unknown>) {
  rejectUnknown(args, new Set(['id']), 'CronDelete');
  if (typeof args.id !== 'string') throw new Error('CronDelete requires string field id.');
  return { id: args.id };
}

export function parseCronListInput(args: Record<string, unknown>) {
  rejectUnknown(args, new Set(), 'CronList');
}

function rejectUnknown(args: Record<string, unknown>, allowed: Set<string>, toolName: string) {
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${toolName} does not accept field(s): ${unknown.join(', ')}.`);
}
