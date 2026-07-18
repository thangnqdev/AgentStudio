import { describe, expect, it } from 'vitest';
import {
  MAX_IDE_SELECTION_TEXT_CHARS,
  parseIdeAtMentionedNotification,
  parseIdeSelectionChangedNotification,
} from './ideSelection.js';

describe('parseIdeSelectionChangedNotification', () => {
  it('converts a zero-based half-open IDE range into one-based selected lines', () => {
    expect(parseIdeSelectionChangedNotification({
      method: 'selection_changed',
      params: {
        filePath: '/workspace/src/main.ts', text: 'selected',
        selection: { start: { line: 4, character: 2 }, end: { line: 6, character: 0 } },
      },
    })).toEqual({
      filePath: '/workspace/src/main.ts', text: 'selected', lineStart: 5, lineEnd: 6,
    });
  });

  it('represents an empty selection as an opened file', () => {
    expect(parseIdeSelectionChangedNotification({
      method: 'selection_changed', params: { filePath: '/workspace/a.ts', text: '', selection: null },
    })).toEqual({ filePath: '/workspace/a.ts' });
  });

  it('rejects malformed, reversed and unbounded notifications', () => {
    expect(parseIdeSelectionChangedNotification({ method: 'other', params: {} })).toBeNull();
    expect(parseIdeSelectionChangedNotification({
      method: 'selection_changed', params: {
        filePath: '/a', text: 'x', selection: { start: { line: 2, character: 0 }, end: { line: 1, character: 0 } },
      },
    })).toBeNull();
    expect(parseIdeSelectionChangedNotification({
      method: 'selection_changed', params: {
        filePath: '/a', text: 'x'.repeat(MAX_IDE_SELECTION_TEXT_CHARS + 1),
        selection: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      },
    })).toBeNull();
  });
});

describe('parseIdeAtMentionedNotification', () => {
  it('converts optional zero-based lines to a one-based inclusive range', () => {
    expect(parseIdeAtMentionedNotification({
      method: 'at_mentioned', params: { filePath: '/workspace/a.ts', lineStart: 4, lineEnd: 7 },
    })).toEqual({ filePath: '/workspace/a.ts', lineStart: 5, lineEnd: 8 });
    expect(parseIdeAtMentionedNotification({
      method: 'at_mentioned', params: { filePath: '/workspace/a.ts', lineStart: 4 },
    })).toEqual({ filePath: '/workspace/a.ts', lineStart: 5, lineEnd: 5 });
  });

  it('rejects end-only, reversed and malformed at-mentions', () => {
    expect(parseIdeAtMentionedNotification({ method: 'at_mentioned', params: { filePath: '/a', lineEnd: 2 } })).toBeNull();
    expect(parseIdeAtMentionedNotification({ method: 'at_mentioned', params: { filePath: '/a', lineStart: 3, lineEnd: 2 } })).toBeNull();
    expect(parseIdeAtMentionedNotification({ method: 'selection_changed', params: { filePath: '/a' } })).toBeNull();
  });
});
