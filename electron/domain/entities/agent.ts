export type PermissionMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export type Attachment = {
  id: string;
  name: string;
  type: 'text' | 'image' | 'audio' | 'video';
  data?: string;
  filePath?: string;
  mimeType?: string;
  size?: number;
};

export type Message = {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  attachments?: Attachment[];
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: unknown;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

export type AgentActionPayload = {
  id: string;
  toolName: string;
  args: string;
  status: 'running' | 'ok' | 'error';
  output?: string;
};

export type AgentProviderSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  contextWindow?: number;
  permissionMode: PermissionMode;
};

export type AgentStartPayload = {
  requestId?: string;
  messages?: Message[];
};

export type AssistantResponse = ChatMessage & {
  finishReason?: string;
};

export type ToolResult = {
  ok: boolean;
  output: string;
};

// Regex dùng chung phía electron để parse tool logs từ text output
export const TOOL_PATTERN = /^\[tool:([^\]]+)\]\s*(.*)$/;
export const TOOL_PREFIX_PATTERN = /^\[tool:([^\]]+)\]/;
