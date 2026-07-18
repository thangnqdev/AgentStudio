import { CRON_RECURRING_MAX_AGE_MS, type CronTask } from './cron.js';
import { nextCronFireAt } from './cronSchedule.js';

export type CronClaimResult = { due: CronTask[]; remaining: CronTask[] };

export function claimDueCronTasks(
  tasks: readonly CronTask[],
  nowMs: number,
  recurringMaxAgeMs = CRON_RECURRING_MAX_AGE_MS,
): CronClaimResult {
  const due: CronTask[] = [];
  const remaining: CronTask[] = [];
  for (const source of tasks) {
    const task = structuredClone(source);
    const nextFireAt = nextCronFireAt(task.cron, task.lastFiredAt ?? task.createdAt);
    if (nextFireAt === null || nowMs < nextFireAt) {
      remaining.push(task);
      continue;
    }
    due.push(task);
    const aged = recurringMaxAgeMs > 0 && nowMs - task.createdAt >= recurringMaxAgeMs;
    if (task.recurring && !aged) remaining.push({ ...task, lastFiredAt: nowMs });
  }
  return { due, remaining };
}
