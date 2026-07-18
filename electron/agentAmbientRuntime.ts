import { CompositeAgentAmbientContextSource } from './application/services/CompositeAgentAmbientContextSource.js';
import { BackgroundCommandCompletionContext } from './application/services/BackgroundCommandCompletionContext.js';
import type { IBackgroundCommandCompletionSource } from './domain/ports/IBackgroundCommandCompletionSource.js';
import { ideSelectionContext } from './ideRuntime.js';
import { lspDiagnosticHub } from './lspRuntime.js';

export function createAgentAmbientContext(backgroundCommands: IBackgroundCommandCompletionSource, scopeId: string) {
  return new CompositeAgentAmbientContextSource([
    lspDiagnosticHub,
    ideSelectionContext,
    new BackgroundCommandCompletionContext(backgroundCommands, scopeId),
  ]);
}
