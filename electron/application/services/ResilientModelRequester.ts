import type { AgentProviderSettings, AssistantResponse, ChatMessage } from '../../domain/entities/agent.js';
import {
  AiProviderRequestError,
  buildModelAttemptPlan,
  isRetryableModelFailure,
  modelRetryDelayMs,
  normalizeModelResiliencePolicy,
} from '../../domain/entities/modelRequest.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';

type Delay = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

export type ModelRequestOutcome = {
  response: AssistantResponse;
  model: string;
  attemptCount: number;
};

export class ResilientModelRequester {
  private readonly provider: IAiProvider;
  private readonly delay: Delay;

  constructor(provider: IAiProvider, delay: Delay = abortableDelay) {
    this.provider = provider;
    this.delay = delay;
  }

  async execute(input: {
    settings: AgentProviderSettings;
    messages: ChatMessage[];
    tools: AgentToolDefinition[];
    eventSink: IAgentEventSink;
    requestId: string;
    signal?: AbortSignal;
  }): Promise<ModelRequestOutcome> {
    const policy = normalizeModelResiliencePolicy({
      retryCount: input.settings.retryCount,
      requestTimeoutMs: input.settings.requestTimeoutMs,
    });
    const attempts = buildModelAttemptPlan(input.settings.model, input.settings.fallbackModels ?? [], policy.retryCount);
    let attemptCount = 0;

    for (let index = 0; index < attempts.length; index += 1) {
      throwIfStopped(input.signal);
      const model = attempts[index];
      const deadline = createAttemptDeadline(input.signal, policy.requestTimeoutMs);
      let streamedCharacters = 0;
      const attemptSink = countingSink(input.eventSink, (chunk) => { streamedCharacters += chunk.length; });
      attemptCount += 1;

      try {
        const response = await this.provider.requestAssistantMessage(
          {
            ...input.settings,
            model,
            contextWindow: input.settings.modelContextWindows?.[model] ?? input.settings.contextWindow,
          },
          input.messages, input.tools, attemptSink, input.requestId, deadline.signal,
        );
        return { response, model, attemptCount };
      } catch (rawError) {
        if (input.signal?.aborted) throw new Error('Agent session stopped.', { cause: rawError });
        const error = deadline.didTimeout()
          ? new AiProviderRequestError('timeout', `Model request timed out after ${policy.requestTimeoutMs}ms.`, { cause: rawError })
          : rawError;
        const canRetry = streamedCharacters === 0 && isRetryableModelFailure(error) && index < attempts.length - 1;
        if (!canRetry) throw error;
        deadline.dispose();
        await this.delay(modelRetryDelayMs(error, attemptCount, policy), input.signal);
      } finally {
        deadline.dispose();
      }
    }

    throw new AiProviderRequestError('unknown', 'Model request attempt plan was empty.');
  }
}

function countingSink(delegate: IAgentEventSink, onChunk: (chunk: string) => void): IAgentEventSink {
  return {
    emitChunk: (requestId, chunk) => { onChunk(chunk); delegate.emitChunk(requestId, chunk); },
    emitAction: (requestId, action) => delegate.emitAction(requestId, action),
    emitDone: (requestId) => delegate.emitDone(requestId),
    emitError: (requestId, error) => delegate.emitError(requestId, error),
    emitTaskStatus: delegate.emitTaskStatus
      ? (requestId, task) => delegate.emitTaskStatus?.(requestId, task)
      : undefined,
  };
}

function createAttemptDeadline(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const stop = () => controller.abort(parent?.reason);
  if (parent?.aborted) stop();
  else parent?.addEventListener('abort', stop, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('Model request deadline exceeded.'));
  }, timeoutMs);
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => { clearTimeout(timeout); parent?.removeEventListener('abort', stop); },
  };
}

function abortableDelay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Agent session stopped.'));
    const stop = () => { clearTimeout(timeout); reject(new Error('Agent session stopped.')); };
    const timeout = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, milliseconds);
    signal?.addEventListener('abort', stop, { once: true });
  });
}

function throwIfStopped(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('Agent session stopped.');
}
