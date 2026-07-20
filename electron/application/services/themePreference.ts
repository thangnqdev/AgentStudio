import type { ResolvedTheme, ThemePreference } from '../../domain/entities/theme.js';

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemIsDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemIsDark ? 'dark' : 'light';
  return preference;
}
