import type { OptimizerState } from '../entities/optimizer.js';

export interface IOptimizerRepository { load(): Promise<OptimizerState>; save(state: OptimizerState): Promise<void>; }
