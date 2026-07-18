import type { AgentActionPayload } from '../../domain/entities/agent.js';
import type { AgentSpanInput, TraceStatus } from '../../domain/entities/agentTrace.js';
import {
  parseWorkerProcessMessages,
  parseWorkerProcessToolResult,
  parseWorkerProcessTools,
  type AgentWorkerProcessToolCallRequest,
} from '../../domain/entities/agentWorkerSessionProcess.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { AgentToolCallRunner, ToolCallRunInput } from '../../application/services/AgentToolCallRunner.js';
import { WorkerProcessRpcClient } from './WorkerProcessRpcClient.js';

export class ParentProcessToolCatalog implements IToolCatalog {
  private readonly rpc: WorkerProcessRpcClient;
  constructor(rpc: WorkerProcessRpcClient) { this.rpc = rpc; }
  async list() { return parseWorkerProcessTools(await this.rpc.request('tools.list', {})); }
}

export class ParentProcessToolRunner implements Pick<AgentToolCallRunner, 'run'> {
  private readonly rpc: WorkerProcessRpcClient;
  constructor(rpc: WorkerProcessRpcClient) { this.rpc = rpc; }
  async run(input: ToolCallRunInput) {
    const payload: AgentWorkerProcessToolCallRequest = {
      requestId: input.requestId, step: input.step, toolCall: input.toolCall,
    };
    return parseWorkerProcessToolResult(await this.rpc.request('tool.run', payload));
  }
}

export class ParentProcessTracer implements IAgentTracer {
  private readonly rpc: WorkerProcessRpcClient;
  constructor(rpc: WorkerProcessRpcClient) { this.rpc = rpc; }
  newSpanId() { return crypto.randomUUID(); }
  async startTrace(_traceId: string, _taskId: string) {}
  async updateTrace(_traceId: string, _taskId: string, _status: TraceStatus) {}
  async recordSpan(input: AgentSpanInput) {
    const result = await this.rpc.request('trace.record', input);
    if (typeof result !== 'string' || !result || result.length > 256) throw new Error('Agent worker trace response is invalid.');
    return result;
  }
}

export class ParentProcessLifecycleHookDispatcher implements ILifecycleHookDispatcher {
  private readonly rpc: WorkerProcessRpcClient;
  constructor(rpc: WorkerProcessRpcClient) { this.rpc = rpc; }
  async dispatch(input: Parameters<ILifecycleHookDispatcher['dispatch']>[0]) {
    if (input.event !== 'PreCompact' && input.event !== 'PostCompact') throw new Error('Worker hook event is not delegated.');
    await this.rpc.request('hook.dispatch', { event: input.event });
    return { matchedHookIds: [], contexts: [], auditLabels: [] };
  }
}

export class ParentProcessEventSink implements IAgentEventSink {
  private readonly rpc: WorkerProcessRpcClient;
  constructor(rpc: WorkerProcessRpcClient) { this.rpc = rpc; }
  emitChunk(requestId: string, value: string) { this.rpc.emit({ kind: 'event', event: 'chunk', requestId, value }); }
  emitDone(requestId: string) { this.rpc.emit({ kind: 'event', event: 'done', requestId }); }
  emitError(requestId: string, value: string) { this.rpc.emit({ kind: 'event', event: 'error', requestId, value }); }
  emitAction(_requestId: string, _action: AgentActionPayload) { throw new Error('Tool actions must be emitted by the parent process.'); }
}

export async function drainParentProcessMessages(rpc: WorkerProcessRpcClient) {
  return parseWorkerProcessMessages(await rpc.request('messages.drain', {}));
}
