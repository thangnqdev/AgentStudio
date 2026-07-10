export interface Attachment {
  id: string;
  name: string;
  type: 'text' | 'image' | 'audio' | 'video';
  data?: string;
  filePath?: string;
  mimeType?: string;
  size?: number;
  previewUrl?: string;
}

export interface AgentAction {
  id: string;
  requestId: string;
  toolName: string;
  args: string;
  status: 'running' | 'ok' | 'error';
  output?: string;
}

export interface AgentThought {
  id: string;
  requestId: string;
  content: string;
  timestamp: Date;
}

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  type?: 'text' | 'code' | 'permission_request';
  status?: 'sending' | 'done' | 'error';
  timestamp: Date;
  attachments?: Attachment[];
  actions?: AgentAction[];
}
