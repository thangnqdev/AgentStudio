import type { IToolCatalog } from './domain/ports/IToolCatalog.js';
import type { IToolExecutor } from './domain/ports/IToolExecutor.js';
import { RemoteTriggerToolPlatform } from './application/services/RemoteTriggerToolPlatform.js';
import { ExecuteRemoteTrigger } from './application/usecases/ExecuteRemoteTrigger.js';
import { ManageRemoteTriggerSettings } from './application/usecases/ManageRemoteTriggerSettings.js';
import { EncryptedRemoteTriggerSettingsRepository } from './infrastructure/remote/EncryptedRemoteTriggerSettingsRepository.js';
import { HttpRemoteTriggerGateway } from './infrastructure/remote/HttpRemoteTriggerGateway.js';

export const remoteTriggerSettingsRepository = new EncryptedRemoteTriggerSettingsRepository();
export const remoteTriggerSettings = new ManageRemoteTriggerSettings(remoteTriggerSettingsRepository);
const executeRemoteTrigger = new ExecuteRemoteTrigger(remoteTriggerSettingsRepository, new HttpRemoteTriggerGateway());

export const remoteTriggerRuntime = {
  decorate(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor) {
    return new RemoteTriggerToolPlatform(baseCatalog, baseExecutor, executeRemoteTrigger, remoteTriggerSettings);
  },
};
