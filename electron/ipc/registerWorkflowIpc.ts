import { ipcMain } from 'electron';
import { workflowDefinitions, workflowRunner } from '../workflowRuntime.js';

function respond<T>(task: () => Promise<T>) { return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({ success: false as const, error: error instanceof Error ? error.message : 'Workflow operation failed.' })); }

export function registerWorkflowIpc() {
  ipcMain.handle('workflows:list-definitions', () => ({ success: true as const, data: workflowDefinitions }));
  ipcMain.handle('workflows:list-runs', (_event, rawLimit: unknown) => respond(() => workflowRunner.list(readLimit(rawLimit))));
  ipcMain.handle('workflows:start', (_event, rawWorkflowId: unknown) => respond(() => workflowRunner.start(findDefinition(rawWorkflowId))));
  ipcMain.handle('workflows:resume', (_event, rawPayload: unknown) => respond(() => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const runId = readId(payload.runId, 'runId'); const workflowId = readId(payload.workflowId, 'workflowId');
    const nodeId = readId(payload.nodeId, 'nodeId');
    if (typeof payload.approved !== 'boolean') throw new Error('approved must be boolean.');
    return workflowRunner.resume(findDefinition(workflowId), runId, { nodeId, approved: payload.approved });
  }));
}

function findDefinition(value: unknown) { const id = readId(value, 'workflowId'); const definition = workflowDefinitions.find((item) => item.id === id); if (!definition) throw new Error('Workflow definition does not exist.'); return definition; }
function readLimit(value: unknown) { return typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(value, 1), 100) : 50; }
function readId(value: unknown, name: string) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_.-]{1,80}$/.test(value)) throw new Error(`${name} is invalid.`); return value; }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
