import type { BackgroundCommandCompletion } from '../entities/backgroundCommand.js';

export interface IBackgroundCommandCompletionSource {
  drainCompleted(scopeId: string): Promise<BackgroundCommandCompletion[]>;
}
