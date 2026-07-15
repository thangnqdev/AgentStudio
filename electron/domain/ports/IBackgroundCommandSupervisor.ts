import type {
  BackgroundCommandOutput,
  BackgroundCommandSnapshot,
  StartBackgroundCommandInput,
} from '../entities/backgroundCommand.js';

export interface IBackgroundCommandSupervisor {
  start(input: StartBackgroundCommandInput): Promise<BackgroundCommandSnapshot>;
  output(
    scopeId: string,
    taskId: string,
    options: { block: boolean; timeoutMs: number; signal?: AbortSignal },
  ): Promise<BackgroundCommandOutput | null>;
  stop(scopeId: string, taskId: string): Promise<BackgroundCommandSnapshot | null>;
}
