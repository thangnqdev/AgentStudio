import type { CronScope, CronTask } from '../../domain/entities/cron.js';
import type { ICronFireSink } from '../../domain/ports/ICronFireSink.js';
import type { ICronTaskRepository } from '../../domain/ports/ICronTaskRepository.js';

const DEFAULT_TICK_INTERVAL_MS = 1_000;
const MIN_TICK_INTERVAL_MS = 250;
const MAX_TICK_INTERVAL_MS = 60_000;

export class CronScheduler {
  private readonly repository: ICronTaskRepository;
  private readonly fireSink: ICronFireSink;
  private readonly scope: CronScope;
  private readonly now: () => number;
  private readonly tickIntervalMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private ticking?: Promise<CronTask[]>;

  constructor(
    repository: ICronTaskRepository,
    fireSink: ICronFireSink,
    scope: CronScope,
    options: { now?: () => number; tickIntervalMs?: number } = {},
  ) {
    this.repository = repository;
    this.fireSink = fireSink;
    this.scope = structuredClone(scope);
    this.now = options.now ?? Date.now;
    this.tickIntervalMs = clampInterval(options.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS);
  }

  start() {
    if (this.timer) return;
    void this.tick().catch(() => undefined);
    this.timer = setInterval(() => { void this.tick().catch(() => undefined); }, this.tickIntervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  tick(nowMs = this.now()): Promise<CronTask[]> {
    if (this.ticking) return Promise.resolve([]);
    const operation = this.runTick(nowMs);
    this.ticking = operation;
    const clear = () => { if (this.ticking === operation) this.ticking = undefined; };
    void operation.then(clear, clear);
    return operation;
  }

  private async runTick(nowMs: number) {
    const due = await this.repository.claimDue(this.scope, nowMs);
    for (const task of due) {
      try {
        await this.fireSink.fire(this.scope, task);
      } catch {
        await this.repository.releaseClaim(this.scope, task).catch(() => undefined);
      }
    }
    return due;
  }
}

function clampInterval(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_TICK_INTERVAL_MS;
  return Math.min(MAX_TICK_INTERVAL_MS, Math.max(MIN_TICK_INTERVAL_MS, Math.floor(value)));
}
