import type { AgentAction, Attachment, Message } from './message';

export type ManualCompactionMessage = Pick<Message, 'id' | 'sender' | 'content'> & {
  attachments?: Array<Pick<Attachment, 'id' | 'name' | 'type' | 'mimeType' | 'size'>>;
  actions?: Array<Pick<AgentAction, 'id' | 'toolName' | 'args' | 'risk' | 'status' | 'output'>>;
};

export type ManualCompactionPayload = {
  messages: ManualCompactionMessage[];
  instructions?: string;
  scopeId?: string;
};

export type ManualCompactionResult = {
  compacted: boolean;
  keptMessageIds: string[];
  summary?: string;
  originalApproxTokens: number;
  compactedApproxTokens: number;
};
