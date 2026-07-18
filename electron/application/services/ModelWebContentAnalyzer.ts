import type { AgentProviderSettings } from '../../domain/entities/agent.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IWebContentAnalyzer } from '../../domain/ports/IWebContentAnalyzer.js';
import { readAssistantContent } from './assistantMessage.js';
import { ResilientModelRequester } from './ResilientModelRequester.js';
import { makeWebFetchAnalysisPrompt, WEB_FETCH_ANALYZER_SYSTEM_PROMPT } from './webFetchPrompt.js';

const SILENT_SINK: IAgentEventSink = {
  emitChunk: () => undefined,
  emitAction: () => undefined,
  emitDone: () => undefined,
  emitError: () => undefined,
};

export class ModelWebContentAnalyzer implements IWebContentAnalyzer {
  private readonly requester: ResilientModelRequester;
  private readonly settings: AgentProviderSettings;
  private readonly createRequestId: () => string;

  constructor(provider: IAiProvider, settings: AgentProviderSettings, createRequestId = () => crypto.randomUUID()) {
    this.requester = new ResilientModelRequester(provider);
    this.settings = settings;
    this.createRequestId = createRequestId;
  }

  async analyze(input: Parameters<IWebContentAnalyzer['analyze']>[0], signal?: AbortSignal) {
    const outcome = await this.requester.execute({
      settings: this.settings,
      messages: [
        { role: 'system', content: WEB_FETCH_ANALYZER_SYSTEM_PROMPT },
        { role: 'user', content: makeWebFetchAnalysisPrompt(input.content, input.prompt, input.preapproved) },
      ],
      tools: [],
      eventSink: SILENT_SINK,
      requestId: `web-fetch-${this.createRequestId()}`,
      signal,
    });
    return readAssistantContent(outcome.response) || 'No response from model.';
  }
}
