import { describe, expect, it } from 'vitest';
import { splitCodeIntoSections } from './codeChunking.js';

describe('splitCodeIntoSections', () => {
  it('keeps top-level functions and class members identifiable', () => {
    const source = [
      "import { z } from 'zod';",
      'export function calculateTotal(amount: number) { return amount * 2; }',
      'export class BookingService {',
      '  createBooking() { return true; }',
      '  cancelBooking() { return false; }',
      '}',
    ].join('\n');

    const sections = splitCodeIntoSections(source, 'booking.ts', '.ts', 80);

    expect(sections.map((section) => section.title)).toContain('Function: calculateTotal');
    expect(sections.map((section) => section.symbol)).toContain('BookingService.createBooking');
    expect(sections.map((section) => section.symbol)).toContain('BookingService.cancelBooking');
  });
});
