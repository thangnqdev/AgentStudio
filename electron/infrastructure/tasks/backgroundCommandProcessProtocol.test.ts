import { describe, expect, it } from 'vitest';
import {
  parseBackgroundCommandProcessBootstrap,
  parseBackgroundCommandProcessState,
  type BackgroundCommandProcessState,
} from './backgroundCommandProcessProtocol.js';

const state: BackgroundCommandProcessState = {
  version: 1,
  snapshot: {
    id: 'bg-test', scopeId: 'thread-1', command: 'npm test', description: 'Run tests',
    workspaceRoot: '/workspace', permissionMode: 'workspace-write', status: 'running',
    startedAt: '2026-07-18T00:00:00.000Z', exitCode: null, outputBytes: 0, outputTruncated: false,
  },
  timeoutAt: '2026-07-18T00:10:00.000Z', heartbeatAt: '2026-07-18T00:00:00.000Z',
  controlToken: 'a'.repeat(43), supervisorPid: 123,
};

describe('background command process protocol', () => {
  it('round-trips a bounded process bootstrap with argument arrays', () => {
    expect(parseBackgroundCommandProcessBootstrap({
      version: 1, directory: '/private/background', state,
      command: { executable: '/bin/sh', args: ['-lc', 'npm test'], cwd: '/workspace' },
    })).toEqual(expect.objectContaining({ state, command: { executable: '/bin/sh', args: ['-lc', 'npm test'], cwd: '/workspace' } }));
  });

  it('rejects malformed capabilities, paths, booleans, and oversized argument sets', () => {
    expect(() => parseBackgroundCommandProcessState({ ...state, controlToken: 'guessable' })).toThrow('control token');
    expect(() => parseBackgroundCommandProcessState({
      ...state, snapshot: { ...state.snapshot, outputTruncated: 'false' },
    })).toThrow('outputTruncated');
    expect(() => parseBackgroundCommandProcessBootstrap({
      version: 1, directory: 'relative', state,
      command: { executable: '/bin/sh', args: [], cwd: '/workspace' },
    })).toThrow('directory');
    expect(() => parseBackgroundCommandProcessBootstrap({
      version: 1, directory: '/private/background', state,
      command: { executable: '/bin/sh', args: Array(513).fill('x'), cwd: '/workspace' },
    })).toThrow('arguments');
  });
});
