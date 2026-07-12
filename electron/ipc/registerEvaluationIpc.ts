import { BrowserWindow, dialog, ipcMain } from 'electron';
import { agentEvaluationRegression, goldenAgentSuite } from '../evaluationRuntime.js';

function respond<T>(task: () => Promise<T>) {
  return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({ success: false as const, error: error instanceof Error ? error.message : 'Evaluation operation failed.' }));
}

export function registerEvaluationIpc(win: BrowserWindow | null) {
  ipcMain.handle('evaluations:list', (_event, rawLimit: unknown) => respond(() => agentEvaluationRegression.list(readLimit(rawLimit))));
  ipcMain.handle('evaluations:run-golden', () => respond(() => agentEvaluationRegression.execute(goldenAgentSuite)));
  ipcMain.handle('evaluations:export', (_event, rawRunId: unknown) => respond(async () => {
    const runId = readRunId(rawRunId);
    const result = win
      ? await dialog.showSaveDialog(win, { title: 'Export evaluation report', defaultPath: `agent-evaluation-${runId.slice(0, 8)}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] })
      : await dialog.showSaveDialog({ title: 'Export evaluation report', defaultPath: `agent-evaluation-${runId.slice(0, 8)}.json` });
    if (result.canceled || !result.filePath) return { canceled: true };
    await agentEvaluationRegression.exportJson(runId, result.filePath);
    return { canceled: false };
  }));
}

function readLimit(value: unknown) { return typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(value, 1), 200) : 50; }
function readRunId(value: unknown) { if (typeof value !== 'string' || !/^[a-f0-9-]{16,64}$/i.test(value)) throw new Error('A valid runId is required.'); return value; }
