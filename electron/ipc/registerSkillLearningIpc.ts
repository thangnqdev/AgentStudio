import { ipcMain } from 'electron';
import { skillLearning } from '../skillLearningRuntime.js';

function respond<T>(task: () => Promise<T>) { return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({ success: false as const, error: error instanceof Error ? error.message : 'Skill learning operation failed.' })); }
export function registerSkillLearningIpc() {
  ipcMain.handle('skill-learning:list', () => respond(() => skillLearning.list()));
  ipcMain.handle('skill-learning:create', (_event, rawTraceId: unknown) => respond(() => skillLearning.createFromTrace(id(rawTraceId, 'traceId'))));
  ipcMain.handle('skill-learning:evaluate', (_event, rawCandidateId: unknown) => respond(() => skillLearning.evaluate(id(rawCandidateId, 'candidateId'))));
  ipcMain.handle('skill-learning:decide', (_event, rawPayload: unknown) => respond(() => { const payload = object(rawPayload); if (typeof payload.approved !== 'boolean') throw new Error('approved must be boolean.'); return skillLearning.decide(id(payload.candidateId, 'candidateId'), payload.approved); }));
  ipcMain.handle('skill-learning:promote', (_event, rawCandidateId: unknown) => respond(() => skillLearning.promote(id(rawCandidateId, 'candidateId'))));
}
function object(value: unknown): Record<string, unknown> { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Payload must be an object.'); return value as Record<string, unknown>; }
function id(value: unknown, name: string) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(value)) throw new Error(`${name} is invalid.`); return value; }
