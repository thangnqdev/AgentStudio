import type {
  PublicRemoteTriggerSettings,
  RemoteTriggerSettings,
  SaveRemoteTriggerSettingsInput,
} from '../../domain/entities/remoteTrigger.js';
import { normalizeRemoteTriggerBaseUrl, normalizeRemoteTriggerToken } from '../../domain/entities/remoteTrigger.js';
import type { IRemoteTriggerSettingsRepository } from '../../domain/ports/IRemoteTriggerSettingsRepository.js';

export class ManageRemoteTriggerSettings {
  private readonly repository: IRemoteTriggerSettingsRepository;

  constructor(repository: IRemoteTriggerSettingsRepository) { this.repository = repository; }

  async load(): Promise<PublicRemoteTriggerSettings> { return toPublic(await this.repository.load()); }

  async save(input: SaveRemoteTriggerSettingsInput): Promise<PublicRemoteTriggerSettings> {
    const current = await this.repository.load();
    const baseUrl = normalizeRemoteTriggerBaseUrl(input.baseUrl);
    const bearerToken = input.clearBearerToken ? undefined : normalizeRemoteTriggerToken(input.bearerToken) ?? current.bearerToken;
    if (input.enabled && !baseUrl) throw new Error('Base URL is required when RemoteTrigger is enabled.');
    if (input.enabled && !bearerToken) throw new Error('Bearer token is required when RemoteTrigger is enabled.');
    const settings: RemoteTriggerSettings = { enabled: input.enabled, baseUrl, bearerToken };
    await this.repository.save(settings);
    return toPublic(settings);
  }
}

function toPublic(settings: RemoteTriggerSettings): PublicRemoteTriggerSettings {
  return { enabled: settings.enabled, baseUrl: settings.baseUrl, hasBearerToken: Boolean(settings.bearerToken) };
}
