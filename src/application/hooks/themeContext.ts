import { createContext } from 'react';
import type { ResolvedTheme, ThemePreference } from '../../domain/entities/theme';

export interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isSaving: boolean;
  error: string | null;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
