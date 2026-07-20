import type { ThemePreference } from '../../domain/entities/theme';
import type { ThemePreferencePort } from '../../domain/ports/theme';

function bridge() {
  if (!window.agentStudio) throw new Error('Electron bridge is not available.');
  return window.agentStudio;
}

export const ThemePreferenceBridge: ThemePreferencePort = {
  async load() {
    if (typeof window === 'undefined' || !window.agentStudio) return 'system';
    const result = await bridge().loadThemePreference();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  async save(preference: ThemePreference) {
    const result = await bridge().saveThemePreference(preference);
    if (!result.success) throw new Error(result.error);
  },
};
