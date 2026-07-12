import { BrowserWindow, dialog, ipcMain } from 'electron';
import { agentTraceService } from '../agentRuntime.js';

function respond<T>(task: () => Promise<T>) {
  return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({
    success: false as const,
    error: error instanceof Error ? error.message : 'Trace operation failed.',
  }));
}

export function registerTraceIpc(win: BrowserWindow | null) {
  ipcMain.handle('traces:list', (_event, rawLimit: unknown) => respond(() => {
    const limit = typeof rawLimit === 'number' && Number.isInteger(rawLimit) ? rawLimit : 100;
    return agentTraceService.list(Math.min(Math.max(limit, 1), 500));
  }));

  ipcMain.handle('traces:get', (_event, rawTraceId: unknown) => respond(async () => {
    const traceId = readTraceId(rawTraceId);
    const details = await agentTraceService.get(traceId);
    if (!details) throw new Error('Trace does not exist.');
    return details;
  }));

  ipcMain.handle('traces:export', (_event, rawTraceId: unknown) => respond(async () => {
    const traceId = readTraceId(rawTraceId);
    const result = win
      ? await dialog.showSaveDialog(win, { title: 'Export agent trace', defaultPath: `agent-trace-${traceId.slice(0, 8)}.jsonl`, filters: [{ name: 'JSON Lines', extensions: ['jsonl'] }] })
      : await dialog.showSaveDialog({ title: 'Export agent trace', defaultPath: `agent-trace-${traceId.slice(0, 8)}.jsonl` });
    if (result.canceled || !result.filePath) return { canceled: true, recordCount: 0 };
    const recordCount = await agentTraceService.exportJsonl(traceId, result.filePath);
    return { canceled: false, recordCount };
  }));
}

function readTraceId(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f0-9-]{16,64}$/i.test(value)) throw new Error('A valid traceId is required.');
  return value;
}
