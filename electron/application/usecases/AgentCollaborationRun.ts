import type { Message } from '../../domain/entities/agent.js';

export type AgentCollaborationRun = {
  waitForBackgroundResults(signal?: AbortSignal): Promise<Message[]>;
};
