import { describe, expect, it } from 'vitest';
import { CRON_RECURRING_MAX_AGE_MS, type CronTask } from './cron.js';
import { claimDueCronTasks } from './cronClaim.js';

describe('claimDueCronTasks', () => {
  it('deletes one-shots and reschedules recurring jobs from now to prevent catch-up bursts', () => {
    const now = new Date(2026, 0, 2, 12, 0, 0).getTime();
    const oneShot = task('one-shot', false, now - 3_600_000);
    const recurring = task('recurring', true, now - 3_600_000);
    const claimed = claimDueCronTasks([oneShot, recurring], now);
    expect(claimed.due.map((item) => item.prompt)).toEqual(['one-shot', 'recurring']);
    expect(claimed.remaining).toEqual([{ ...recurring, lastFiredAt: now }]);
    expect(claimDueCronTasks(claimed.remaining, now).due).toEqual([]);
  });

  it('fires an aged recurring job one final time and then removes it', () => {
    const now = new Date(2026, 0, 8, 12, 0, 0).getTime();
    const aged = task('aged', true, now - CRON_RECURRING_MAX_AGE_MS);
    const claimed = claimDueCronTasks([aged], now);
    expect(claimed.due).toHaveLength(1);
    expect(claimed.remaining).toEqual([]);
  });
});

function task(prompt: string, recurring: boolean, createdAt: number): CronTask {
  return { id: '1234abcd', cron: '*/5 * * * *', prompt, recurring, durable: false, createdAt };
}
