import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ThemePreference } from '../../domain/entities/theme';
import type { ThemeEnvironmentPort, ThemePreferencePort } from '../../domain/ports/theme';
import { resolveTheme } from '../services/theme';
import { ThemeContext, type ThemeContextValue } from './themeContext';

interface ThemeProviderProps {
  children: ReactNode;
  environment: ThemeEnvironmentPort;
  initialPreference: ThemePreference;
  preferencePort: ThemePreferencePort;
}

export function ThemeProvider(props: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState(props.initialPreference);
  const [systemIsDark, setSystemIsDark] = useState(() => props.environment.isSystemDark());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedTheme = resolveTheme(preference, systemIsDark);

  useEffect(() => props.environment.subscribe(setSystemIsDark), [props.environment]);
  useEffect(() => props.environment.apply(resolvedTheme), [props.environment, resolvedTheme]);

  const setPreference = useCallback(async (nextPreference: ThemePreference) => {
    const previousPreference = preference;
    setPreferenceState(nextPreference);
    setError(null);
    setIsSaving(true);
    try {
      await props.preferencePort.save(nextPreference);
    } catch (saveError) {
      setPreferenceState(previousPreference);
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu lựa chọn giao diện.');
    } finally {
      setIsSaving(false);
    }
  }, [preference, props.preferencePort]);

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    resolvedTheme,
    isSaving,
    error,
    setPreference,
  }), [error, isSaving, preference, resolvedTheme, setPreference]);

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}
