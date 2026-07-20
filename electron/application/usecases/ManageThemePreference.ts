import type { ThemePreference } from '../../domain/entities/theme.js';
import type { ISettingsRepository } from '../../domain/ports/ISettingsRepository.js';

export class ManageThemePreference {
  private readonly settings: ISettingsRepository;

  constructor(settings: ISettingsRepository) {
    this.settings = settings;
  }

  async load(): Promise<ThemePreference> {
    return (await this.settings.loadStoredSettings()).themePreference;
  }

  async save(preference: ThemePreference): Promise<void> {
    const settings = await this.settings.loadStoredSettings();
    settings.themePreference = preference;
    await this.settings.saveStoredSettings(settings);
  }
}
