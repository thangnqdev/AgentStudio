import type { CronScope, CronTask } from '../entities/cron.js';

export interface ICronFireSink {
  fire(scope: CronScope, task: CronTask): Promise<void>;
}
