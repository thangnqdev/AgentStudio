import type { ResolvedTheme, ThemePreference } from '../entities/theme';

export interface ThemePreferencePort {
  load(): Promise<ThemePreference>;
  save(preference: ThemePreference): Promise<void>;
}

export interface ThemeEnvironmentPort {
  isSystemDark(): boolean;
  apply(theme: ResolvedTheme): void;
  subscribe(listener: (systemIsDark: boolean) => void): () => void;
}
