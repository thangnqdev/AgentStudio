import { describe, expect, it } from 'vitest';
import { parsePdfPageRange } from './pdfPageRange.js';

describe('parsePdfPageRange', () => {
  it('accepts one-based single pages and bounded inclusive ranges', () => {
    expect(parsePdfPageRange('3')).toEqual({ firstPage: 3, lastPage: 3 });
    expect(parsePdfPageRange(' 1-20 ')).toEqual({ firstPage: 1, lastPage: 20 });
  });

  it.each(['', '0', '3-', '4-2', '1-21', '1.5', '1-2-3', '1foo'])(
    'rejects invalid or oversized range %s',
    (value) => expect(parsePdfPageRange(value)).toBeNull(),
  );
});
