import type { ResolvedTheme } from '../../domain/entities/theme';
import type { ThemeEnvironmentPort } from '../../domain/ports/theme';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export const BrowserThemeEnvironment: ThemeEnvironmentPort = {
  isSystemDark() {
    return window.matchMedia(SYSTEM_DARK_QUERY).matches;
  },
  apply(theme: ResolvedTheme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  },
  subscribe(listener: (systemIsDark: boolean) => void) {
    const mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY);
    const handleChange = (event: MediaQueryListEvent) => listener(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  },
};
