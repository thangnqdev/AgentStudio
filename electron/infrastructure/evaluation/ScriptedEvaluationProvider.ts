import type {
  AgentProviderSettings,
  AssistantResponse,
  ChatMessage,
} from '../../domain/entities/agent.js';
import type { RuntimeEvaluationResponse } from '../../domain/entities/agentEvaluation.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';

export class ScriptedEvaluationProvider implements IAiProvider {
  private responseIndex = 0;
  private expectedToolResults = 0;
  private readonly responses: readonly RuntimeEvaluationResponse[];

  constructor(responses: readonly RuntimeEvaluationResponse[]) {
    this.responses = responses;
  }

  async requestAssistantMessage(
    _settings: AgentProviderSettings,
    messages: ChatMessage[],
    tools: AgentToolDefinition[],
    eventSink: IAgentEventSink,
    requestId: string,
  ): Promise<AssistantResponse> {
    const response = this.responses[this.responseIndex];
    if (!response) throw new Error('Scripted evaluation provider ran out of responses.');
    const observedToolResults = messages.filter((message) => message.role === 'tool').length;
    if (observedToolResults !== this.expectedToolResults) {
      throw new Error(`Expected ${this.expectedToolResults} tool results before model turn ${this.responseIndex + 1}, received ${observedToolResults}.`);
    }

    const definitions = new Set(tools.map((tool) => tool.name));
    const toolCalls = (response.toolCalls ?? []).map((call, index) => {
      if (!definitions.has(call.name)) throw new Error(`Script requested unavailable tool: ${call.name}`);
      return {
        id: `scripted-${this.responseIndex + 1}-${index + 1}`,
        type: 'function',
        function: { name: call.name, arguments: JSON.stringify(call.args) },
      };
    });
    this.expectedToolResults += toolCalls.length;
    this.responseIndex += 1;
    if (response.content) eventSink.emitChunk(requestId, response.content);
    return {
      role: 'assistant',
      content: response.content ?? '',
      tool_calls: toolCalls,
      finishReason: toolCalls.length ? 'tool_calls' : 'stop',
    };
  }

  assertComplete() {
    if (this.responseIndex !== this.responses.length) {
      throw new Error(`Runtime completed after ${this.responseIndex} of ${this.responses.length} scripted responses.`);
    }
  }
}
