import { describe, expect, it } from 'vitest';
import { parseManualCompactionInput } from './manualCompactionInput.js';

describe('parseManualCompactionInput', () => {
  it('bounds instructions and reuses strict message validation', () => {
    const result = parseManualCompactionInput({
      scopeId: 'thread-1', instructions: `  preserve decisions ${'x'.repeat(3_000)}  `,
      messages: [
        { id: 'valid', sender: 'user', content: 'hello', extra: 'ignored' },
      ],
    });
    expect(result.scopeId).toBe('thread-1');
    expect(result.instructions).toHaveLength(2_000);
    expect(result.messages).toEqual([{ id: 'valid', sender: 'user', content: 'hello' }]);
  });

  it('rejects invalid, duplicate or silently truncated histories', () => {
    expect(() => parseManualCompactionInput({ messages: [{ id: '', sender: 'user', content: 'bad' }] }))
      .toThrow('Có tin nhắn compact không hợp lệ.');
    expect(() => parseManualCompactionInput({ messages: [
      { id: 'same', sender: 'user', content: 'one' },
      { id: 'same', sender: 'agent', content: 'two' },
    ] })).toThrow('ID tin nhắn compact bị trùng.');
    expect(() => parseManualCompactionInput({
      messages: Array.from({ length: 1_001 }, (_, index) => ({ id: `m-${index}`, sender: 'user', content: 'x' })),
    })).toThrow('tối đa 1000 tin nhắn');
  });
});
