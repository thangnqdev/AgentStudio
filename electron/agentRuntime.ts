import type { WebContents } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type PermissionMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export type Attachment = {
  id: string;
  name: string;
  type: 'text' | 'image' | 'audio' | 'video';
  data: string;
};

export type Message = {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  attachments?: Attachment[];
};

export type AgentProviderSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  permissionMode: PermissionMode;
};

export type AgentStartPayload = {
  requestId?: string;
  messages?: Message[];
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: unknown;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

type ToolCall = {
  id: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

type StreamingToolCall = {
  index: number;
  id: string;
  type?: string;
  function: {
    name: string;
    arguments: string;
  };
};

type ToolResult = {
  ok: boolean;
  output: string;
};

const MAX_AGENT_STEPS = 8;
const MAX_FILE_BYTES = 200_000;
const MAX_COMMAND_OUTPUT = 40_000;

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and folders inside the current workspace.',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Workspace-relative directory. Defaults to current workspace root.' },
          maxEntries: { type: 'number', description: 'Maximum entries to return.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file from the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative file path.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write UTF-8 text to a workspace file. Blocked in read-only mode.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative file path.' },
          content: { type: 'string', description: 'Full file content to write.' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command in the workspace. Blocked in read-only mode. Sandboxed in workspace-write mode.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to run.' },
          timeoutMs: { type: 'number', description: 'Timeout in milliseconds, max 30000.' },
        },
        required: ['command'],
      },
    },
  },
];

export async function runAgentSession(
  payload: AgentStartPayload,
  sender: WebContents,
  settings: AgentProviderSettings,
  workspaceRoot: string,
  signal?: AbortSignal,
) {
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : '';
  if (!requestId) {
    sender.send('ai:chat:error', { requestId: '', error: 'Thiếu requestId.' });
    return;
  }

  if (!settings.model) {
    throw new Error('Chưa chọn model AI.');
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const conversation: ChatMessage[] = [
    {
      role: 'system',
      content: buildAgentSystemPrompt(workspaceRoot, settings.permissionMode),
    },
    ...formatMessages(messages),
  ];

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    if (signal?.aborted) throw new Error('Agent session stopped.');

    const assistantMessage = await requestAssistantMessage(settings, conversation, sender, requestId, signal);
    const content = readAssistantContent(assistantMessage);
    const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];

    conversation.push({
      role: 'assistant',
      content,
      tool_calls: toolCalls,
    });

    if (toolCalls.length === 0) {
      sender.send('ai:chat:done', { requestId });
      return;
    }

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function?.name || '';
      const args = parseToolArguments(toolCall.function?.arguments || '{}');
      emitChunk(sender, requestId, `\n\n[tool:${toolName}] ${JSON.stringify(args)}\n`);

      const result = await executeTool(toolName, args, workspaceRoot, settings.permissionMode);
      emitChunk(sender, requestId, result.ok ? `[ok]\n${result.output}\n` : `[blocked/error]\n${result.output}\n`);

      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  emitChunk(sender, requestId, '\n\nAgent dừng vì đạt giới hạn số bước. Hãy thu hẹp yêu cầu hoặc chạy tiếp.');
  sender.send('ai:chat:done', { requestId });
}

function buildAgentSystemPrompt(workspaceRoot: string, permissionMode: PermissionMode) {
  return [
    'You are AgentStudio, a local coding agent embedded in an Electron app.',
    'Use tools when you need to inspect, edit, or test the project. Explain concise progress to the user.',
    `Workspace root: ${workspaceRoot}`,
    `Permission mode: ${permissionMode}`,
    'Permission rules:',
    '- read-only: inspect only; write_file and run_command are blocked.',
    '- workspace-write: read/write only inside workspace; commands run through the sandbox executor.',
    '- danger-full-access: commands run without sandbox and file paths may be absolute.',
    'Do not claim a command or edit succeeded unless the tool result says it did.',
  ].join('\n');
}

function formatMessages(messages: Message[]): ChatMessage[] {
  return messages.map((message) => {
    if (!Array.isArray(message.attachments) || message.attachments.length === 0) {
      return {
        role: message.sender === 'user' ? 'user' : 'assistant',
        content: message.content,
      };
    }

    const parts: Array<Record<string, unknown>> = [];
    for (const attachment of message.attachments) {
      if (attachment.type === 'image') {
        parts.push({ type: 'image_url', image_url: { url: attachment.data } });
      } else if (attachment.type === 'text') {
        parts.push({ type: 'text', text: `[File: ${attachment.name}]\n\`\`\`\n${attachment.data}\n\`\`\`` });
      } else {
        parts.push({ type: 'text', text: `[${attachment.type} attachment: ${attachment.name}]` });
      }
    }

    if (message.content) {
      parts.push({ type: 'text', text: message.content });
    }

    return {
      role: message.sender === 'user' ? 'user' : 'assistant',
      content: parts,
    };
  });
}

async function requestAssistantMessage(
  settings: AgentProviderSettings,
  messages: ChatMessage[],
  sender: WebContents,
  requestId: string,
  signal?: AbortSignal,
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  }

  const response = await fetch(buildEndpoint(settings.baseUrl, 'chat/completions'), {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: settings.model,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body returned from the API.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const toolCalls = new Map<number, StreamingToolCall>();
  let content = '';
  let buffer = '';

  while (true) {
    if (signal?.aborted) throw new Error('Agent session stopped.');

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      if (trimmed === 'data: [DONE]') {
        return {
          role: 'assistant' as const,
          content,
          tool_calls: normalizeStreamingToolCalls(toolCalls),
        };
      }

      const chunk = parseSseJson(trimmed.slice(6));
      if (!chunk) continue;

      const delta = readChoiceDelta(chunk);
      if (!delta) continue;

      const contentDelta = delta.content;
      if (typeof contentDelta === 'string' && contentDelta) {
        content += contentDelta;
        emitChunk(sender, requestId, contentDelta);
      }

      const toolCallDeltas = delta.tool_calls;
      if (Array.isArray(toolCallDeltas)) {
        mergeToolCallDeltas(toolCalls, toolCallDeltas);
      }
    }
  }

  return {
    role: 'assistant' as const,
    content,
    tool_calls: normalizeStreamingToolCalls(toolCalls),
  };
}

function parseSseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function readChoiceDelta(chunk: unknown): Record<string, unknown> | null {
  if (!isObject(chunk) || !Array.isArray(chunk.choices)) return null;
  const choice = chunk.choices[0];
  if (!isObject(choice) || !isObject(choice.delta)) return null;
  return choice.delta;
}

function mergeToolCallDeltas(toolCalls: Map<number, StreamingToolCall>, deltas: unknown[]) {
  for (const rawDelta of deltas) {
    if (!isObject(rawDelta)) continue;

    const index = typeof rawDelta.index === 'number' ? rawDelta.index : toolCalls.size;
    const existing = toolCalls.get(index) ?? {
      index,
      id: '',
      function: {
        name: '',
        arguments: '',
      },
    };

    if (typeof rawDelta.id === 'string') {
      existing.id = rawDelta.id;
    }
    if (typeof rawDelta.type === 'string') {
      existing.type = rawDelta.type;
    }
    if (isObject(rawDelta.function)) {
      if (typeof rawDelta.function.name === 'string') {
        existing.function.name += rawDelta.function.name;
      }
      if (typeof rawDelta.function.arguments === 'string') {
        existing.function.arguments += rawDelta.function.arguments;
      }
    }

    toolCalls.set(index, existing);
  }
}

function normalizeStreamingToolCalls(toolCalls: Map<number, StreamingToolCall>): ToolCall[] {
  return [...toolCalls.values()]
    .sort((left, right) => left.index - right.index)
    .filter((toolCall) => toolCall.function.name)
    .map((toolCall) => ({
      id: toolCall.id || `tool-${toolCall.index}`,
      type: toolCall.type || 'function',
      function: {
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      },
    }));
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  workspaceRoot: string,
  permissionMode: PermissionMode,
): Promise<ToolResult> {
  try {
    if (toolName === 'list_files') {
      return listFiles(args, workspaceRoot, permissionMode);
    }
    if (toolName === 'read_file') {
      return readFileTool(args, workspaceRoot, permissionMode);
    }
    if (toolName === 'write_file') {
      return writeFileTool(args, workspaceRoot, permissionMode);
    }
    if (toolName === 'run_command') {
      return runCommandTool(args, workspaceRoot, permissionMode);
    }

    return { ok: false, output: `Unknown tool: ${toolName}` };
  } catch (error) {
    return { ok: false, output: error instanceof Error ? error.message : 'Unknown tool error' };
  }
}

async function listFiles(args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode): Promise<ToolResult> {
  const dir = resolvePath(getString(args.dir) || '.', workspaceRoot, permissionMode);
  const maxEntries = Math.min(Math.max(Number(args.maxEntries) || 200, 1), 500);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const visibleEntries = entries
    .filter((entry) => !['node_modules', '.git', 'dist', 'dist-electron'].includes(entry.name))
    .slice(0, maxEntries)
    .map((entry) => `${entry.isDirectory() ? 'dir ' : 'file'} ${entry.name}`)
    .join('\n');

  return { ok: true, output: visibleEntries || '(empty)' };
}

async function readFileTool(args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode): Promise<ToolResult> {
  const filePath = resolvePath(getString(args.path), workspaceRoot, permissionMode);
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    return { ok: false, output: 'Path is not a file.' };
  }
  if (stat.size > MAX_FILE_BYTES) {
    return { ok: false, output: `File too large (${stat.size} bytes). Limit is ${MAX_FILE_BYTES} bytes.` };
  }

  return { ok: true, output: await fs.readFile(filePath, 'utf8') };
}

async function writeFileTool(args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode): Promise<ToolResult> {
  if (permissionMode === 'read-only') {
    return { ok: false, output: 'write_file is blocked in read-only mode.' };
  }

  const filePath = resolvePath(getString(args.path), workspaceRoot, permissionMode);
  const content = getString(args.content);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  return { ok: true, output: `Wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${path.relative(workspaceRoot, filePath) || filePath}.` };
}

async function runCommandTool(args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode): Promise<ToolResult> {
  if (permissionMode === 'read-only') {
    return { ok: false, output: 'run_command is blocked in read-only mode.' };
  }

  const command = getString(args.command).trim();
  if (!command) {
    return { ok: false, output: 'Command is empty.' };
  }

  const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || 15_000, 1_000), 30_000);
  return runSandboxedCommand(command, workspaceRoot, permissionMode, timeoutMs);
}

async function runSandboxedCommand(
  command: string,
  workspaceRoot: string,
  permissionMode: PermissionMode,
  timeoutMs: number,
): Promise<ToolResult> {
  if (permissionMode === 'danger-full-access') {
    return spawnAndCollect('/bin/sh', ['-lc', command], workspaceRoot, timeoutMs);
  }

  if (process.platform === 'darwin') {
    const sandboxExec = '/usr/bin/sandbox-exec';
    if (!await fileExists(sandboxExec)) {
      return { ok: false, output: 'sandbox-exec not found; refusing to run command in workspace-write mode.' };
    }

    const profile = buildSeatbeltProfile(workspaceRoot);
    return spawnAndCollect(sandboxExec, ['-p', profile, '/bin/sh', '-lc', command], workspaceRoot, timeoutMs);
  }

  if (process.platform === 'linux') {
    if (!await commandExists('bwrap')) {
      return { ok: false, output: 'bubblewrap (bwrap) not found; refusing to run command in workspace-write mode.' };
    }

    return spawnAndCollect('bwrap', [
      '--ro-bind', '/', '/',
      '--dev', '/dev',
      '--proc', '/proc',
      '--tmpfs', '/tmp',
      '--bind', workspaceRoot, workspaceRoot,
      '--chdir', workspaceRoot,
      '--unshare-net',
      '/bin/sh',
      '-lc',
      command,
    ], workspaceRoot, timeoutMs);
  }

  return { ok: false, output: `Sandboxed command execution is not implemented on ${process.platform}.` };
}

function buildSeatbeltProfile(workspaceRoot: string) {
  const escapedWorkspace = workspaceRoot.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const tmp = os.tmpdir().replaceAll('\\', '\\\\').replaceAll('"', '\\"');

  return [
    '(version 1)',
    '(deny default)',
    '(allow process*)',
    '(allow signal (target self))',
    '(allow sysctl-read)',
    '(allow file-read*)',
    `(allow file-write* (subpath "${escapedWorkspace}") (subpath "${tmp}") (subpath "/tmp") (subpath "/private/tmp"))`,
  ].join('\n');
}

function spawnAndCollect(command: string, args: string[], cwd: string, timeoutMs: number): Promise<ToolResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({ ok: false, output: trimOutput(`${output}\nCommand timed out after ${timeoutMs}ms.`) });
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
      output = trimOutput(output);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
      output = trimOutput(output);
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, output: error.message });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        output: trimOutput(`${output}\nExit code: ${code ?? 'unknown'}`),
      });
    });
  });
}

function resolvePath(inputPath: string, workspaceRoot: string, permissionMode: PermissionMode) {
  if (!inputPath) {
    throw new Error('Path is required.');
  }

  const resolved = path.resolve(permissionMode === 'danger-full-access' && path.isAbsolute(inputPath)
    ? inputPath
    : path.join(workspaceRoot, inputPath));

  if (permissionMode !== 'danger-full-access' && !isInsidePath(resolved, workspaceRoot)) {
    throw new Error(`Path escapes workspace: ${inputPath}`);
  }

  return resolved;
}

function isInsidePath(candidate: string, root: string) {
  const relative = path.relative(root, candidate);
  return relative === '' || Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readAssistantContent(message: ChatMessage) {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map((part) => isObject(part) && typeof part.text === 'string' ? part.text : '').join('');
  }
  return '';
}

function buildEndpoint(baseUrl: string, endpoint: string) {
  return new URL(endpoint, `${baseUrl.replace(/\/$/, '')}/`).toString();
}

function emitChunk(sender: WebContents, requestId: string, chunk: string) {
  if (chunk) {
    sender.send('ai:chat:chunk', { requestId, chunk });
  }
}

function trimOutput(output: string) {
  if (output.length <= MAX_COMMAND_OUTPUT) return output;
  return `${output.slice(0, MAX_COMMAND_OUTPUT)}\n[output truncated]`;
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function commandExists(command: string) {
  const pathEntries = (process.env.PATH || '').split(path.delimiter);
  for (const entry of pathEntries) {
    if (await fileExists(path.join(entry, command))) return true;
  }
  return false;
}
