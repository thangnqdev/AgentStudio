import type { ToolCall } from '../../domain/entities/agent.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { AgentToolCallRunner, ToolCallRunInput } from './AgentToolCallRunner.js';

type BatchInput = Omit<ToolCallRunInput, 'toolCall' | 'toolDefinition'> & {
  toolCalls: ToolCall[];
  toolsByName: ReadonlyMap<string, AgentToolDefinition>;
  workspaceRootProvider?: () => string;
  signal?: AbortSignal;
};

type Runnable = { call: ToolCall; definition?: AgentToolDefinition };

export class AgentToolBatchRunner {
  private readonly runner: Pick<AgentToolCallRunner, 'run'>;
  private readonly maximumConcurrency: number;

  constructor(runner: Pick<AgentToolCallRunner, 'run'>, maximumConcurrency = 10) {
    this.runner = runner;
    this.maximumConcurrency = Math.min(Math.max(Math.trunc(maximumConcurrency), 1), 20);
  }

  async run(input: BatchInput) {
    const runnable = input.toolCalls.map((call) => ({
      call,
      definition: input.toolsByName.get(call.function?.name || ''),
    }));
    const groups = partitionRunnableTools(runnable);
    const results: Awaited<ReturnType<AgentToolCallRunner['run']>>[] = [];

    for (const group of groups) {
      throwIfStopped(input.signal);
      if (group.concurrent) {
        for (let index = 0; index < group.items.length; index += this.maximumConcurrency) {
          const window = group.items.slice(index, index + this.maximumConcurrency);
          results.push(...await Promise.all(window.map((item) => this.runOne(input, item))));
        }
      } else {
        results.push(await this.runOne(input, group.items[0]));
      }
    }
    return results;
  }

  private runOne(input: BatchInput, item: Runnable) {
    throwIfStopped(input.signal);
    return this.runner.run({
      eventSink: input.eventSink,
      permissionMode: input.permissionMode,
      requestId: input.requestId,
      step: input.step,
      workspaceRoot: input.workspaceRootProvider?.() ?? input.workspaceRoot,
      traceContext: input.traceContext,
      signal: input.signal,
      toolCall: item.call,
      toolDefinition: item.definition,
    });
  }
}

export function partitionRunnableTools(items: Runnable[]) {
  const groups: Array<{ concurrent: boolean; items: Runnable[] }> = [];
  for (const item of items) {
    const concurrent = item.definition?.risk === 'read' && item.definition.concurrencySafe === true;
    const previous = groups.at(-1);
    if (concurrent && previous?.concurrent) previous.items.push(item);
    else groups.push({ concurrent, items: [item] });
  }
  return groups;
}

function throwIfStopped(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('Agent session stopped.');
}
