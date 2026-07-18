import { describe, expect, it } from 'vitest';
import { parseCronCreateInput, parseCronDeleteInput, parseCronListInput } from './cronInput.js';

const NOW = new Date(2026, 0, 2, 8, 0, 0).getTime();

describe('cron input', () => {
  it('applies create defaults and accepts only the exact schema', () => {
    expect(parseCronCreateInput({ cron: '0 9 * * *', prompt: 'check' }, NOW)).toEqual({
      cron: '0 9 * * *', prompt: 'check', recurring: true, durable: false,
    });
    expect(() => parseCronCreateInput({ cron: '0 9 * * *', prompt: 'check', extra: true }, NOW)).toThrow('does not accept');
    expect(() => parseCronCreateInput({ cron: '0 9 * * *', prompt: 'check', recurring: 'yes' }, NOW)).toThrow('boolean');
  });

  it('rejects invalid or calendar-impossible schedules within the next year', () => {
    expect(() => parseCronCreateInput({ cron: '0 9 * *', prompt: 'check' }, NOW)).toThrow('Expected 5 fields');
    expect(() => parseCronCreateInput({ cron: '0 9 30 2 *', prompt: 'check' }, NOW)).toThrow('next year');
  });

  it('strictly parses delete and list arguments', () => {
    expect(parseCronDeleteInput({ id: '1234abcd' })).toEqual({ id: '1234abcd' });
    expect(() => parseCronDeleteInput({ id: '1234abcd', prompt: 'x' })).toThrow('does not accept');
    expect(parseCronListInput({})).toBeUndefined();
    expect(() => parseCronListInput({ id: 'x' })).toThrow('does not accept');
  });
});
