import { describe, expect, it } from 'vitest';
import { nextCronFireAt, parseCronExpression } from './cronSchedule.js';

describe('cronSchedule', () => {
  it('strictly parses the supported five-field local cron subset', () => {
    const parsed = parseCronExpression('*/5 0-23/2 1,15 * 1-5');
    expect(parsed?.minute).toEqual(Array.from({ length: 12 }, (_, index) => index * 5));
    expect(parsed).toMatchObject({ dayOfMonth: [1, 15], dayOfWeek: [1, 2, 3, 4, 5] });
    expect(parseCronExpression('0 9 * * 7')?.dayOfWeek).toEqual([0]);
    expect(parseCronExpression('0 9 * * * extra')).toBeNull();
    expect(parseCronExpression('60 9 * * *')).toBeNull();
    expect(parseCronExpression('*/0 9 * * *')).toBeNull();
    expect(parseCronExpression('0 9 * * MON')).toBeNull();
  });

  it('returns the next local match strictly after the anchor', () => {
    const before = new Date(2026, 0, 2, 8, 59, 30).getTime();
    expect(nextCronFireAt('0 9 * * *', before)).toBe(new Date(2026, 0, 2, 9, 0, 0).getTime());
    const exact = new Date(2026, 0, 2, 9, 0, 0).getTime();
    expect(nextCronFireAt('0 9 * * *', exact)).toBe(new Date(2026, 0, 3, 9, 0, 0).getTime());
  });

  it('uses standard day-of-month/day-of-week OR semantics and bounds search to one year', () => {
    const friday = new Date(2026, 0, 2, 0, 0, 0);
    const next = nextCronFireAt('0 9 15 * 5', friday.getTime());
    expect(next).toBe(new Date(2026, 0, 2, 9, 0, 0).getTime());
    expect(nextCronFireAt('0 9 30 2 *', friday.getTime())).toBeNull();
  });
});
