import type { ResolvedTheme, ThemePreference } from '../../domain/entities/theme';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemIsDark ? 'dark' : 'light';
  return preference;
}
