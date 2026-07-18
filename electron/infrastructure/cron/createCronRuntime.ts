import { CronToolPlatform, type CronPlatformIdentity } from '../../application/services/CronToolPlatform.js';
import type { CronScope } from '../../domain/entities/cron.js';
import type { ICronFireSink } from '../../domain/ports/ICronFireSink.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import { CronScheduler } from './CronScheduler.js';
import { PrivateCronTaskRepository } from './PrivateCronTaskRepository.js';

export function createCronRuntime(storageDirectory: string | (() => string), fireSink: ICronFireSink) {
  const repository = new PrivateCronTaskRepository(storageDirectory);
  const schedulers = new Map<string, CronScheduler>();
  const activate = (scope: CronScope) => {
    const key = JSON.stringify(scope);
    if (schedulers.has(key)) return;
    const scheduler = new CronScheduler(repository, fireSink, scope);
    schedulers.set(key, scheduler);
    scheduler.start();
  };
  return {
    repository,
    decorate(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor, identity: CronPlatformIdentity) {
      return new CronToolPlatform(baseCatalog, baseExecutor, repository, identity, Date.now, activate);
    },
    createScheduler(scope: CronScope, options?: { now?: () => number; tickIntervalMs?: number }) {
      return new CronScheduler(repository, fireSink, scope, options);
    },
    stopAll() {
      for (const scheduler of schedulers.values()) scheduler.stop();
      schedulers.clear();
    },
  };
}
