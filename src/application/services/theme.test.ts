import { describe, expect, it } from 'vitest';
import { isThemePreference, resolveTheme } from './theme';

describe('theme', () => {
  it('follows the system color scheme for the system preference', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
  });

  it('keeps an explicit preference regardless of the system color scheme', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('recognizes only supported theme preferences', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('sepia')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});
