import type { CreateCronTaskInput, CronScope, CronTask } from '../entities/cron.js';

export interface ICronTaskRepository {
  create(scope: CronScope, input: CreateCronTaskInput, nowMs: number): Promise<CronTask>;
  list(scope: CronScope): Promise<CronTask[]>;
  remove(scope: CronScope, id: string): Promise<boolean>;
  claimDue(scope: CronScope, nowMs: number): Promise<CronTask[]>;
  releaseClaim(scope: CronScope, task: CronTask): Promise<void>;
}
