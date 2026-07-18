import type {
  AgentProviderSettings,
  ChatMessage,
  Message,
  ToolCall,
} from './agent.js';
import type { AgentTaskCheckpoint } from './agentTask.js';
import type { AgentSpanInput } from './agentTrace.js';
import type { AgentWorkerRecord } from './agentWorker.js';
import type { AgentToolDefinition } from './tool.js';

export const MAX_WORKER_PROCESS_MESSAGE_BYTES = 30_000_000;

export type AgentWorkerSessionProcessBootstrap = {
  worker: AgentWorkerRecord;
  settings: AgentProviderSettings;
  workspaceRoot: string;
  guidanceContext?: string;
};

export type AgentWorkerProcessToolCallRequest = {
  requestId: string;
  step: number;
  toolCall: ToolCall;
};

export type AgentWorkerProcessToolCallResult = {
  stepContent: string;
  toolMessage: ChatMessage & { role: 'tool'; tool_call_id: string; content: string };
  supplementalMessages?: ChatMessage[];
};

export type AgentWorkerCompactionHookEvent = 'PreCompact' | 'PostCompact';

export type AgentWorkerProcessRequest =
  | { kind: 'request'; id: string; method: 'tools.list'; payload: Record<string, never> }
  | { kind: 'request'; id: string; method: 'tool.run'; payload: AgentWorkerProcessToolCallRequest }
  | { kind: 'request'; id: string; method: 'checkpoint'; payload: AgentTaskCheckpoint }
  | { kind: 'request'; id: string; method: 'messages.drain'; payload: Record<string, never> }
  | { kind: 'request'; id: string; method: 'hook.dispatch'; payload: { event: AgentWorkerCompactionHookEvent } }
  | { kind: 'request'; id: string; method: 'trace.record'; payload: AgentSpanInput };

export type AgentWorkerProcessResponse = {
  kind: 'response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

export type AgentWorkerProcessEvent = {
  kind: 'event';
  event: 'chunk' | 'done' | 'error';
  requestId: string;
  value?: string;
};

export type AgentWorkerProcessResult = {
  kind: 'result';
  ok: boolean;
  status?: 'completed' | 'paused';
  completedSteps?: number;
  error?: string;
};

export type AgentWorkerProcessMessage = AgentWorkerProcessRequest | AgentWorkerProcessResponse
  | AgentWorkerProcessEvent | AgentWorkerProcessResult;

export function parseWorkerProcessBootstrap(value: unknown): AgentWorkerSessionProcessBootstrap {
  const object = record(value, 'Worker process bootstrap');
  exactKeys(object, ['worker', 'settings', 'workspaceRoot', 'guidanceContext']);
  const worker = parseWorker(object.worker);
  const settings = parseSettings(object.settings);
  const workspaceRoot = text(object.workspaceRoot, 'Worker process workspace', 4_000);
  const guidanceContext = optionalText(object.guidanceContext, 'Worker process guidance', 100_000);
  if (settings.permissionMode !== worker.permissionMode) throw new Error('Worker process permission mode is inconsistent.');
  return { worker, settings, workspaceRoot, ...(guidanceContext ? { guidanceContext } : {}) };
}

export function parseWorkerProcessMessage(value: unknown): AgentWorkerProcessMessage {
  const object = record(value, 'Worker process message');
  const kind = object.kind;
  if (kind === 'request') return parseRequest(object);
  if (kind === 'response') return parseResponse(object);
  if (kind === 'event') return parseEvent(object);
  if (kind === 'result') return parseResult(object);
  throw new Error('Worker process message kind is invalid.');
}

export function parseWorkerProcessTools(value: unknown): AgentToolDefinition[] {
  if (!Array.isArray(value) || value.length > 1_000) throw new Error('Worker tool catalog is invalid.');
  return value.map((item) => {
    const tool = record(item, 'Worker tool definition');
    if (!['read', 'write', 'execute', 'network'].includes(String(tool.risk))) throw new Error('Worker tool risk is invalid.');
    text(tool.name, 'Worker tool name', 256); text(tool.description, 'Worker tool description', 20_000);
    record(tool.parameters, 'Worker tool parameters');
    return structuredClone(item as AgentToolDefinition);
  });
}

export function parseWorkerProcessToolResult(value: unknown): AgentWorkerProcessToolCallResult {
  const object = record(value, 'Worker tool result');
  exactKeys(object, ['stepContent', 'toolMessage', 'supplementalMessages']);
  const toolMessage = parseChatMessage(object.toolMessage);
  if (toolMessage.role !== 'tool' || typeof toolMessage.tool_call_id !== 'string' || typeof toolMessage.content !== 'string') {
    throw new Error('Worker tool result message is invalid.');
  }
  const supplementalMessages = object.supplementalMessages === undefined
    ? undefined
    : parseSupplementalMessages(object.supplementalMessages);
  return {
    stepContent: text(object.stepContent, 'Worker tool step content', 2_000_000, true),
    toolMessage: toolMessage as ChatMessage & { role: 'tool'; tool_call_id: string; content: string },
    ...(supplementalMessages?.length ? { supplementalMessages } : {}),
  };
}

function parseSupplementalMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('Worker supplemental tool messages are invalid.');
  return value.map((message) => {
    const parsed = parseChatMessage(message);
    if (parsed.role !== 'user' || parsed.tool_call_id !== undefined || parsed.tool_calls !== undefined) {
      throw new Error('Worker supplemental tool message is invalid.');
    }
    return parsed;
  });
}

export function parseWorkerProcessMessages(value: unknown): Message[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Worker drained messages are invalid.');
  return value.map(parseMessage);
}

function parseRequest(object: Record<string, unknown>): AgentWorkerProcessRequest {
  exactKeys(object, ['kind', 'id', 'method', 'payload']);
  const id = identifier(object.id, 'Worker request id');
  const method = object.method;
  if (method === 'tools.list' || method === 'messages.drain') {
    exactKeys(record(object.payload, 'Worker request payload'), []);
    return { kind: 'request', id, method, payload: {} };
  }
  if (method === 'tool.run') return { kind: 'request', id, method, payload: parseToolRequest(object.payload) };
  if (method === 'checkpoint') return { kind: 'request', id, method, payload: parseCheckpoint(object.payload) };
  if (method === 'hook.dispatch') return { kind: 'request', id, method, payload: parseCompactionHook(object.payload) };
  if (method === 'trace.record') return { kind: 'request', id, method, payload: parseModelSpan(object.payload) };
  throw new Error('Worker request method is invalid.');
}

function parseCompactionHook(value: unknown): { event: AgentWorkerCompactionHookEvent } {
  const payload = record(value, 'Worker hook request'); exactKeys(payload, ['event']);
  if (payload.event !== 'PreCompact' && payload.event !== 'PostCompact') throw new Error('Worker hook event is invalid.');
  return { event: payload.event as AgentWorkerCompactionHookEvent };
}

function parseResponse(object: Record<string, unknown>): AgentWorkerProcessResponse {
  exactKeys(object, ['kind', 'id', 'ok', 'result', 'error']);
  const ok = boolean(object.ok, 'Worker response status');
  const error = optionalText(object.error, 'Worker response error', 2_000);
  if (ok && error || !ok && !error) throw new Error('Worker response invariant is invalid.');
  return { kind: 'response', id: identifier(object.id, 'Worker response id'), ok, ...(object.result !== undefined ? { result: object.result } : {}), ...(error ? { error } : {}) };
}

function parseEvent(object: Record<string, unknown>): AgentWorkerProcessEvent {
  exactKeys(object, ['kind', 'event', 'requestId', 'value']);
  if (!['chunk', 'done', 'error'].includes(String(object.event))) throw new Error('Worker event type is invalid.');
  const event = object.event as AgentWorkerProcessEvent['event'];
  const value = optionalText(object.value, 'Worker event value', 100_000);
  if (event === 'error' && !value || event === 'done' && value) throw new Error('Worker event invariant is invalid.');
  return { kind: 'event', event, requestId: identifier(object.requestId, 'Worker event request id'), ...(value ? { value } : {}) };
}

function parseResult(object: Record<string, unknown>): AgentWorkerProcessResult {
  exactKeys(object, ['kind', 'ok', 'status', 'completedSteps', 'error']);
  const ok = boolean(object.ok, 'Worker result status');
  const error = optionalText(object.error, 'Worker result error', 2_000);
  if (!ok) {
    if (!error) throw new Error('Worker failure result requires an error.');
    return { kind: 'result', ok, error };
  }
  if (!['completed', 'paused'].includes(String(object.status)) || !boundedInteger(object.completedSteps, 0, 10_000)) {
    throw new Error('Worker success result is invalid.');
  }
  return { kind: 'result', ok, status: object.status as 'completed' | 'paused', completedSteps: object.completedSteps as number };
}

function parseToolRequest(value: unknown): AgentWorkerProcessToolCallRequest {
  const object = record(value, 'Worker tool request'); exactKeys(object, ['requestId', 'step', 'toolCall']);
  const call = record(object.toolCall, 'Worker tool call'); exactKeys(call, ['id', 'type', 'function']);
  const fn = record(call.function, 'Worker tool function'); exactKeys(fn, ['name', 'arguments']);
  return {
    requestId: identifier(object.requestId, 'Worker tool request id'),
    step: integer(object.step, 'Worker tool step', 0, 10_000),
    toolCall: {
      id: identifier(call.id, 'Worker tool call id'),
      ...(typeof call.type === 'string' ? { type: text(call.type, 'Worker tool call type', 64) } : {}),
      function: {
        name: text(fn.name, 'Worker tool name', 256),
        arguments: text(fn.arguments, 'Worker tool arguments', 2_000_000, true),
      },
    },
  };
}

function parseCheckpoint(value: unknown): AgentTaskCheckpoint {
  const checkpoint = record(value, 'Worker checkpoint');
  exactKeys(checkpoint, ['id', 'traceId', 'workspaceRoot', 'status', 'completedSteps', 'messages', 'conversation', 'knowledgeContext']);
  if (!['running', 'paused', 'completed', 'failed'].includes(String(checkpoint.status))) throw new Error('Worker checkpoint status is invalid.');
  if (!Array.isArray(checkpoint.messages) || !Array.isArray(checkpoint.conversation)) throw new Error('Worker checkpoint transcript is invalid.');
  return {
    id: identifier(checkpoint.id, 'Worker checkpoint id'), traceId: identifier(checkpoint.traceId, 'Worker checkpoint trace'),
    workspaceRoot: text(checkpoint.workspaceRoot, 'Worker checkpoint workspace', 4_000),
    status: checkpoint.status as AgentTaskCheckpoint['status'], completedSteps: integer(checkpoint.completedSteps, 'Worker checkpoint steps', 0, 10_000),
    messages: checkpoint.messages.map(parseMessage), conversation: checkpoint.conversation.map(parseChatMessage),
    ...(typeof checkpoint.knowledgeContext === 'string' ? { knowledgeContext: text(checkpoint.knowledgeContext, 'Worker checkpoint knowledge', 2_000_000, true) } : {}),
  };
}

function parseModelSpan(value: unknown): AgentSpanInput {
  const span = record(value, 'Worker model span');
  exactKeys(span, ['kind', 'traceId', 'taskId', 'requestId', 'parentSpanId', 'spanId', 'step', 'startedAt', 'endedAt', 'status', 'model', 'finishReason', 'usage']);
  if (span.kind !== 'model_call') throw new Error('Worker process may record only model spans.');
  const traceId = identifier(span.traceId, 'Worker span trace'); const taskId = identifier(span.taskId, 'Worker span task');
  const startedAt = isoDate(span.startedAt, 'Worker span start'); const endedAt = isoDate(span.endedAt, 'Worker span end');
  const model = text(span.model, 'Worker span model', 1_000);
  if (!['succeeded', 'failed'].includes(String(span.status))) throw new Error('Worker model span status is invalid.');
  const step = span.step === undefined ? undefined : integer(span.step, 'Worker model span step', 0, 10_000);
  const requestId = optionalText(span.requestId, 'Worker span request', 256);
  const parentSpanId = optionalText(span.parentSpanId, 'Worker parent span', 256);
  const spanId = optionalText(span.spanId, 'Worker span id', 256);
  const finishReason = optionalText(span.finishReason, 'Worker finish reason', 256);
  const usage = span.usage === undefined ? undefined : parseUsage(span.usage);
  return {
    kind: 'model_call', traceId, taskId, startedAt, endedAt, status: span.status as 'succeeded' | 'failed', model,
    ...(requestId ? { requestId } : {}), ...(parentSpanId ? { parentSpanId } : {}), ...(spanId ? { spanId } : {}),
    ...(step !== undefined ? { step } : {}), ...(finishReason ? { finishReason } : {}), ...(usage ? { usage } : {}),
  };
}

function parseWorker(value: unknown): AgentWorkerRecord {
  const worker = record(value, 'Worker bootstrap record');
  exactKeys(worker, [
    'id', 'traceId', 'parentScopeId', 'parentAgentId', 'name', 'teamName', 'description', 'prompt', 'subagentType', 'model',
    'permissionMode', 'isolation', 'cwd', 'workspaceRoot', 'depth', 'background', 'status', 'createdAt', 'updatedAt',
    'completedSteps', 'messages', 'conversation', 'result', 'error', 'worktreePath', 'worktreeBranch',
  ]);
  for (const field of ['id', 'traceId', 'parentScopeId', 'description', 'prompt', 'workspaceRoot', 'createdAt', 'updatedAt'] as const) {
    text(worker[field], `Worker ${field}`, 100_000);
  }
  if (!['read-only', 'workspace-write', 'danger-full-access'].includes(String(worker.permissionMode))) throw new Error('Worker permission mode is invalid.');
  if (!['running', 'paused', 'completed', 'failed', 'killed'].includes(String(worker.status))) throw new Error('Worker status is invalid.');
  integer(worker.depth, 'Worker depth', 0, 10); integer(worker.completedSteps, 'Worker completed steps', 0, 10_000);
  boolean(worker.background, 'Worker background flag');
  if (!Array.isArray(worker.messages) || !Array.isArray(worker.conversation)) throw new Error('Worker transcript is invalid.');
  worker.messages.map(parseMessage); worker.conversation.map(parseChatMessage);
  return structuredClone(worker as unknown as AgentWorkerRecord);
}

function parseSettings(value: unknown): AgentProviderSettings {
  const settings = record(value, 'Worker provider settings');
  exactKeys(settings, ['baseUrl', 'apiKey', 'model', 'fallbackModels', 'modelContextWindows', 'retryCount', 'requestTimeoutMs', 'contextWindow', 'contextBudgetTokens', 'permissionMode']);
  const baseUrl = text(settings.baseUrl, 'Worker setting baseUrl', 4_000);
  const apiKey = text(settings.apiKey, 'Worker setting apiKey', 100_000, true);
  const model = text(settings.model, 'Worker setting model', 4_000);
  if (!['read-only', 'workspace-write', 'danger-full-access'].includes(String(settings.permissionMode))) throw new Error('Worker setting permission mode is invalid.');
  const fallbackModels = stringArray(settings.fallbackModels, 'Worker fallback models', 20, 1_000);
  const modelContextWindows = numberRecord(settings.modelContextWindows, 'Worker model context windows');
  const retryCount = optionalInteger(settings.retryCount, 'Worker retry count', 0, 5);
  const requestTimeoutMs = optionalInteger(settings.requestTimeoutMs, 'Worker request timeout', 1, 600_000);
  const contextWindow = optionalInteger(settings.contextWindow, 'Worker context window', 1, 10_000_000);
  const contextBudgetTokens = optionalInteger(settings.contextBudgetTokens, 'Worker context budget', 1, 10_000_000);
  return {
    baseUrl, apiKey, model, permissionMode: settings.permissionMode as AgentProviderSettings['permissionMode'],
    ...(fallbackModels ? { fallbackModels } : {}), ...(modelContextWindows ? { modelContextWindows } : {}),
    ...(retryCount !== undefined ? { retryCount } : {}), ...(requestTimeoutMs !== undefined ? { requestTimeoutMs } : {}),
    ...(contextWindow !== undefined ? { contextWindow } : {}), ...(contextBudgetTokens !== undefined ? { contextBudgetTokens } : {}),
  };
}

function parseMessage(value: unknown): Message {
  const message = record(value, 'Worker message');
  exactKeys(message, ['id', 'sender', 'content', 'attachments', 'actions']);
  if (!['user', 'agent', 'system'].includes(String(message.sender))) throw new Error('Worker message sender is invalid.');
  identifier(message.id, 'Worker message id'); text(message.content, 'Worker message content', 100_000, true);
  if (message.attachments !== undefined && !Array.isArray(message.attachments)) throw new Error('Worker message attachments are invalid.');
  if (message.actions !== undefined && !Array.isArray(message.actions)) throw new Error('Worker message actions are invalid.');
  return structuredClone(message as unknown as Message);
}

function parseChatMessage(value: unknown): ChatMessage {
  const message = record(value, 'Worker chat message');
  exactKeys(message, ['role', 'content', 'tool_call_id', 'tool_calls']);
  if (!['system', 'user', 'assistant', 'tool'].includes(String(message.role))) throw new Error('Worker chat message role is invalid.');
  if (message.tool_call_id !== undefined) identifier(message.tool_call_id, 'Worker chat tool call id');
  if (message.tool_calls !== undefined && !Array.isArray(message.tool_calls)) throw new Error('Worker chat tool calls are invalid.');
  return structuredClone(message as unknown as ChatMessage);
}

function parseUsage(value: unknown) {
  const usage = record(value, 'Worker model usage'); exactKeys(usage, ['inputTokens', 'outputTokens', 'totalTokens', 'cachedInputTokens', 'cacheCreationInputTokens']);
  const inputTokens = integer(usage.inputTokens, 'Worker input tokens', 0, Number.MAX_SAFE_INTEGER);
  const outputTokens = integer(usage.outputTokens, 'Worker output tokens', 0, Number.MAX_SAFE_INTEGER);
  const totalTokens = integer(usage.totalTokens, 'Worker total tokens', inputTokens + outputTokens, Number.MAX_SAFE_INTEGER);
  const cachedInputTokens = optionalInteger(usage.cachedInputTokens, 'Worker cached tokens', 0, inputTokens);
  const cacheCreationInputTokens = optionalInteger(usage.cacheCreationInputTokens, 'Worker cache creation tokens', 0, inputTokens);
  return { inputTokens, outputTokens, totalTokens, ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}), ...(cacheCreationInputTokens !== undefined ? { cacheCreationInputTokens } : {}) };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} is invalid.`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  const keys = new Set(allowed); if (Object.keys(value).some((key) => !keys.has(key))) throw new Error('Worker process payload contains unknown fields.');
}
function text(value: unknown, label: string, maximum: number, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value) || value.length > maximum || value.includes('\0')) throw new Error(`${label} is invalid.`);
  return value;
}
function optionalText(value: unknown, label: string, maximum: number) { return value === undefined ? undefined : text(value, label, maximum, true); }
function identifier(value: unknown, label: string) { return text(value, label, 256); }
function boolean(value: unknown, label: string) { if (typeof value !== 'boolean') throw new Error(`${label} is invalid.`); return value; }
function integer(value: unknown, label: string, minimum: number, maximum: number) {
  if (!boundedInteger(value, minimum, maximum)) throw new Error(`${label} is invalid.`); return value;
}
function boundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}
function optionalInteger(value: unknown, label: string, minimum: number, maximum: number) {
  return value === undefined ? undefined : integer(value, label, minimum, maximum);
}
function stringArray(value: unknown, label: string, maximumItems: number, maximumLength: number) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(`${label} is invalid.`);
  return value.map((item) => text(item, label, maximumLength));
}
function numberRecord(value: unknown, label: string) {
  if (value === undefined) return undefined;
  const object = record(value, label); if (Object.keys(object).length > 100) throw new Error(`${label} is invalid.`);
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [text(key, label, 1_000), integer(item, label, 1, 10_000_000)]));
}
function isoDate(value: unknown, label: string) {
  const result = text(value, label, 100); if (!Number.isFinite(Date.parse(result))) throw new Error(`${label} is invalid.`); return result;
}
