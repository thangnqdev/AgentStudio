import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BackgroundCommandProcessHost } from '../BackgroundCommandProcessHost.js';
import { BackgroundCommandProcessSupervisor } from '../BackgroundCommandProcessSupervisor.js';

const directory = process.argv[2];
if (!directory || !path.isAbsolute(directory)) throw new Error('Fixture output directory is invalid.');
const entry = fileURLToPath(new URL('../../../backgroundCommandProcess.ts', import.meta.url));
const loader = fileURLToPath(new URL('../../../../node_modules/tsx/dist/loader.mjs', import.meta.url));
const supervisor = new BackgroundCommandProcessSupervisor(
  directory,
  new BackgroundCommandProcessHost(entry, ['--import', loader]),
  () => 'bg-parent-exit',
);
const task = await supervisor.start({
  scopeId: 'thread-1', command: 'sleep 0.8; printf after-parent-exit', description: 'Parent exit fixture',
  workspaceRoot: os.tmpdir(), permissionMode: 'danger-full-access', timeoutMs: 3_000,
});
process.stdout.write(`${JSON.stringify({ id: task.id })}\n`);
