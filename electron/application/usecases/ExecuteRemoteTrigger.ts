import { parseRemoteTriggerInput } from '../../domain/entities/remoteTrigger.js';
import type { IRemoteTriggerGateway } from '../../domain/ports/IRemoteTriggerGateway.js';
import type { IRemoteTriggerSettingsRepository } from '../../domain/ports/IRemoteTriggerSettingsRepository.js';

export class ExecuteRemoteTrigger {
  private readonly settings: IRemoteTriggerSettingsRepository;
  private readonly gateway: IRemoteTriggerGateway;

  constructor(
    settings: IRemoteTriggerSettingsRepository,
    gateway: IRemoteTriggerGateway,
  ) { this.settings = settings; this.gateway = gateway; }

  async execute(rawInput: Record<string, unknown>, signal?: AbortSignal) {
    const settings = await this.settings.load();
    if (!settings.enabled || !settings.baseUrl || !settings.bearerToken) throw new Error('RemoteTrigger is disabled or not fully configured.');
    return this.gateway.execute(parseRemoteTriggerInput(rawInput), settings, signal);
  }
}
