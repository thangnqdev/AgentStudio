import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ManageBackgroundCommands } from './application/usecases/ManageBackgroundCommands.js';
import { BackgroundCommandProcessHost } from './infrastructure/tasks/BackgroundCommandProcessHost.js';
import { BackgroundCommandProcessSupervisor } from './infrastructure/tasks/BackgroundCommandProcessSupervisor.js';
import { ElectronBackgroundCommandNotifier } from './infrastructure/tasks/ElectronBackgroundCommandNotifier.js';
import { lifecycleHookDispatcher } from './hookRuntime.js';

export const backgroundCommandProcessHost = new BackgroundCommandProcessHost(
  fileURLToPath(new URL(/* @vite-ignore */ './background-command-process.js', import.meta.url)),
);
export const backgroundCommandSupervisor = new BackgroundCommandProcessSupervisor(
  () => path.join(app.getPath('userData'), 'background-command-output'),
  backgroundCommandProcessHost,
);
export const backgroundCommandManager = new ManageBackgroundCommands(backgroundCommandSupervisor);
export const backgroundCommandNotifier = new ElectronBackgroundCommandNotifier(backgroundCommandSupervisor, lifecycleHookDispatcher);
app.once('before-quit', () => backgroundCommandNotifier.stop());
