import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_OPTIMIZATION_CONFIG, OPTIMIZER_STATE_VERSION, assertOptimizerState, type OptimizerState } from '../../domain/entities/optimizer.js';
import type { IOptimizerRepository } from '../../domain/ports/IOptimizerRepository.js';

export class JsonOptimizerRepository implements IOptimizerRepository {
  private readonly configuredPath?: string;
  constructor(configuredPath?: string) { this.configuredPath = configuredPath; }

  async load(): Promise<OptimizerState> {
    try { const state = JSON.parse(await fs.readFile(this.getPath(), 'utf8')) as OptimizerState; assertOptimizerState(state); return state; }
    catch (error) {
      if (isMissingFile(error)) return { version: OPTIMIZER_STATE_VERSION, revision: 1, active: structuredClone(DEFAULT_OPTIMIZATION_CONFIG), candidates: [], history: [] };
      throw new Error('Persisted optimizer state is invalid.', { cause: error });
    }
  }

  async save(state: OptimizerState) {
    assertOptimizerState(state); const target = this.getPath(); const temporary = `${target}.tmp`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, target); await fs.chmod(target, 0o600).catch(() => undefined);
  }

  private getPath() { return this.configuredPath ?? path.join(app.getPath('userData'), 'optimizer', 'state.json'); }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
