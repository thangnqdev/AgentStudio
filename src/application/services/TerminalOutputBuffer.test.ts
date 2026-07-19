import { describe, expect, it } from 'vitest';
import { TerminalOutputBuffer } from './TerminalOutputBuffer';

describe('TerminalOutputBuffer', () => {
  it('keeps PTY output emitted before terminal:create resolves', () => {
    const buffer = new TerminalOutputBuffer();
    expect(buffer.accept({ terminalId: 'terminal-1', data: 'prompt' }, null)).toBeNull();
    expect(buffer.drain('terminal-1')).toEqual(['prompt']);
  });

  it('streams matching output immediately and ignores another session', () => {
    const buffer = new TerminalOutputBuffer();
    expect(buffer.accept({ terminalId: 'terminal-1', data: 'one' }, 'terminal-1')).toBe('one');
    expect(buffer.accept({ terminalId: 'terminal-2', data: 'two' }, 'terminal-1')).toBeNull();
  });
});
