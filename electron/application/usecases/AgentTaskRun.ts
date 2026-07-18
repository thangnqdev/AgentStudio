import type { ChatMessage, Message } from '../../domain/entities/agent.js';
import type { AgentTaskCheckpoint } from '../../domain/entities/agentTask.js';

export type AgentTaskRun = {
  id: string;
  traceId: string;
  workspaceRoot: string;
  completedSteps: number;
  messages: Message[];
  conversation: ChatMessage[];
  knowledgeContext?: string;
  onCheckpoint?: (checkpoint: AgentTaskCheckpoint) => Promise<void>;
  drainMessages?: () => Promise<Message[]>;
};
