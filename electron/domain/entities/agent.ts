import type { ToolRisk } from './tool.js';

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
  sender: 'user' | 'agent' | 'system';
  content: string;
  attachments?: Attachment[];
  actions?: AgentActionPayload[];
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
  risk: ToolRisk;
  status: 'awaiting_approval' | 'denied' | 'running' | 'ok' | 'error';
  output?: string;
};

export type AgentProviderSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModels?: string[];
  modelContextWindows?: Record<string, number>;
  retryCount?: number;
  requestTimeoutMs?: number;
  contextWindow?: number;
  contextBudgetTokens?: number;
  permissionMode: PermissionMode;
};

export type AgentStartPayload = {
  requestId?: string;
  taskId?: string;
  taskListId?: string;
  messages?: Message[];
};

export type AgentTaskStatusPayload = {
  taskId: string;
  status: 'paused' | 'completed';
  completedSteps: number;
};

export type AssistantResponse = ChatMessage & {
  finishReason?: string;
  usage?: ModelTokenUsage;
};

export type ModelTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
};

export type ToolResult = {
  ok: boolean;
  output: string;
};

// Regex dùng chung phía electron để parse tool logs từ text output
export const TOOL_PATTERN = /^\[tool:([^\]]+)\]\s*(.*)$/;
export const TOOL_PREFIX_PATTERN = /^\[tool:([^\]]+)\]/;
