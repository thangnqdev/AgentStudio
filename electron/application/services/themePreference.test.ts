import { describe, expect, it } from 'vitest';
import { normalizeThemePreference, resolveThemePreference } from './themePreference.js';

describe('themePreference', () => {
  it('normalizes invalid persisted values to system', () => {
    expect(normalizeThemePreference('sepia')).toBe('system');
    expect(normalizeThemePreference(undefined)).toBe('system');
  });

  it('resolves system and explicit preferences', () => {
    expect(resolveThemePreference('system', true)).toBe('dark');
    expect(resolveThemePreference('system', false)).toBe('light');
    expect(resolveThemePreference('dark', false)).toBe('dark');
    expect(resolveThemePreference('light', true)).toBe('light');
  });
});
