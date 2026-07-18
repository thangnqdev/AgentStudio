import type { RemoteTriggerSettings } from '../entities/remoteTrigger.js';

export interface IRemoteTriggerSettingsRepository {
  load(): Promise<RemoteTriggerSettings>;
  save(settings: RemoteTriggerSettings): Promise<void>;
}
