import { describe, expect, it } from 'vitest';
import { clampSidebarWidth } from './sidebarLayout';

describe('clampSidebarWidth', () => {
  it('keeps the sidebar usable while resizing', () => {
    expect(clampSidebarWidth(100)).toBe(220);
    expect(clampSidebarWidth(318.7)).toBe(319);
    expect(clampSidebarWidth(900)).toBe(420);
  });
});
