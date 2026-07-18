import type { RemoteTriggerInput, RemoteTriggerOutput, RemoteTriggerSettings } from '../entities/remoteTrigger.js';

export interface IRemoteTriggerGateway {
  execute(input: RemoteTriggerInput, settings: RemoteTriggerSettings, signal?: AbortSignal): Promise<RemoteTriggerOutput>;
}
