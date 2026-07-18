import type { Message } from '../entities/agent.js';
import type { AgentTaskCheckpoint } from '../entities/agentTask.js';
import type { AgentSpanInput } from '../entities/agentTrace.js';
import type { AgentToolDefinition } from '../entities/tool.js';
import type {
  AgentWorkerProcessEvent,
  AgentWorkerCompactionHookEvent,
  AgentWorkerProcessToolCallRequest,
  AgentWorkerProcessToolCallResult,
  AgentWorkerSessionProcessBootstrap,
} from '../entities/agentWorkerSessionProcess.js';

export type AgentWorkerSessionProcessCallbacks = {
  listTools(): Promise<AgentToolDefinition[]>;
  runTool(request: AgentWorkerProcessToolCallRequest): Promise<AgentWorkerProcessToolCallResult>;
  checkpoint(checkpoint: AgentTaskCheckpoint): Promise<void>;
  drainMessages(): Promise<Message[]>;
  dispatchHook(event: AgentWorkerCompactionHookEvent): Promise<void>;
  recordSpan(span: AgentSpanInput): Promise<string>;
  emit(event: AgentWorkerProcessEvent): void;
};

export interface IAgentWorkerSessionProcessHost {
  run(
    input: { cwd: string; bootstrap: AgentWorkerSessionProcessBootstrap },
    callbacks: AgentWorkerSessionProcessCallbacks,
    signal: AbortSignal,
  ): Promise<{ status: 'completed' | 'paused'; completedSteps: number }>;
}
