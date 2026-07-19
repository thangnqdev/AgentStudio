import { describe, expect, it } from 'vitest';
import { normalizePipeTerminalInput } from './normalizeTerminalInput.js';

describe('normalizePipeTerminalInput', () => {
  it('converts terminal Return into a newline for the non-PTY fallback', () => {
    expect(normalizePipeTerminalInput('echo ready\r')).toBe('echo ready\n');
    expect(normalizePipeTerminalInput('one\r\ntwo')).toBe('one\ntwo');
  });
});
