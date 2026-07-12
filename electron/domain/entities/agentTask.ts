import type { ChatMessage, Message } from './agent.js';

export type AgentTaskStatus = 'running' | 'paused' | 'completed' | 'failed';

export type AgentTaskRecord = {
  id: string;
  traceId: string;
  title: string;
  workspaceRoot: string;
  status: AgentTaskStatus;
  createdAt: string;
  updatedAt: string;
  completedSteps: number;
  messages: Message[];
  conversation: ChatMessage[];
  knowledgeContext?: string;
  lastError?: string;
};

export type AgentTaskCheckpoint = Pick<AgentTaskRecord,
  'id' | 'traceId' | 'workspaceRoot' | 'status' | 'completedSteps' | 'messages' | 'conversation' | 'knowledgeContext' | 'lastError'>;

export type AgentTaskSummary = Pick<AgentTaskRecord,
  'id' | 'traceId' | 'title' | 'workspaceRoot' | 'status' | 'createdAt' | 'updatedAt' | 'completedSteps' | 'lastError'>;

export function summarizeAgentTask(task: AgentTaskRecord): AgentTaskSummary {
  const { conversation: _conversation, knowledgeContext: _knowledgeContext, messages: _messages, ...summary } = task;
  return summary;
}
