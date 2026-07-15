import { describe, expect, it } from 'vitest';
import {
  parseBackgroundCommandOutput,
  parseBackgroundCommandStart,
  wantsBackgroundCommand,
} from './backgroundCommandInput.js';

describe('background command input', () => {
  it('recognizes only an explicit background request and applies bounded defaults', () => {
    expect(wantsBackgroundCommand({ runInBackground: true })).toBe(true);
    expect(wantsBackgroundCommand({ run_in_background: true })).toBe(true);
    expect(wantsBackgroundCommand({ runInBackground: 'true' })).toBe(false);
    expect(parseBackgroundCommandStart({ command: ' npm test ', description: ' Verify tests ' })).toEqual({
      command: 'npm test',
      description: 'Verify tests',
      timeoutMs: 120_000,
    });
  });

  it('rejects malformed start and retrieval inputs', () => {
    expect(() => parseBackgroundCommandStart({ command: '', timeoutMs: 500 })).toThrow('command is required');
    expect(() => parseBackgroundCommandStart({ command: 'npm test', timeoutMs: 600_001 })).toThrow('timeoutMs');
    expect(() => parseBackgroundCommandOutput({ taskId: 'bg-1', block: 'yes' })).toThrow('block must be a boolean');
  });

  it('supports blocking and non-blocking output retrieval', () => {
    expect(parseBackgroundCommandOutput({ taskId: 'bg-1' })).toEqual({ taskId: 'bg-1', block: true, timeoutMs: 30_000 });
    expect(parseBackgroundCommandOutput({ task_id: 'bg-2' })).toEqual({ taskId: 'bg-2', block: true, timeoutMs: 30_000 });
    expect(parseBackgroundCommandOutput({ taskId: 'bg-1', block: false, timeoutMs: 0 })).toEqual({ taskId: 'bg-1', block: false, timeoutMs: 0 });
  });
});
