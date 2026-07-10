import type { WebContents } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { buildSummarySystemMessage, compactContext } from '../../contextCompaction.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { 
  AgentStartPayload, 
  AgentProviderSettings, 
  Message, 
  ChatMessage,
  PermissionMode,
  ToolResult,
  AgentActionPayload,
  Attachment
} from '../../domain/entities/agent.js';

const MAX_AGENT_STEPS = 30;
const MAX_FILE_BYTES = 200_000;
const MAX_IMAGE_BYTES = 5_000_000;
const MAX_COMMAND_OUTPUT = 40_000;
const MAX_RESPONSE_TOKENS = 8_192;
const DEFAULT_INPUT_CONTEXT_TOKENS = 24_000;

export class RunAgentSession {
  private provider: IAiProvider;

  constructor(provider: IAiProvider) {
    this.provider = provider;
  }

  async execute(
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
    const inputContextTokens = this.getInputContextTokenBudget(settings.contextWindow);
    const compactedContext = compactContext(messages, inputContextTokens);
    const conversation: ChatMessage[] = [
      {
        role: 'system',
        content: this.buildAgentSystemPrompt(workspaceRoot, settings.permissionMode),
      },
      ...(compactedContext.summary ? [{
        role: 'system' as const,
        content: buildSummarySystemMessage(compactedContext.summary),
      }] : []),
      ...await this.formatMessages(compactedContext.recentMessages),
    ];

    for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
      if (signal?.aborted) throw new Error('Agent session stopped.');

      const assistantMessage = await this.provider.requestAssistantMessage(
        settings, 
        conversation, 
        sender, 
        requestId, 
        signal
      );
      
      const content = this.readAssistantContent(assistantMessage);
      const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];

      conversation.push({
        role: 'assistant',
        content,
        tool_calls: toolCalls,
      });

      if (toolCalls.length === 0) {
        if (assistantMessage.finishReason === 'length') {
          this.emitChunk(sender, requestId, '\n\n[Phản hồi bị cắt vì chạm giới hạn output token. Hãy gửi "tiếp tục" nếu muốn AI viết tiếp phần còn lại.]');
        } else if (assistantMessage.finishReason === 'stream_closed') {
          this.emitChunk(sender, requestId, '\n\n[Stream từ server đóng trước khi gửi tín hiệu kết thúc. Nội dung phía trên có thể chưa hoàn chỉnh.]');
        }
        sender.send('ai:chat:done', { requestId });
        return;
      }

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function?.name || '';
        const args = this.parseToolArguments(toolCall.function?.arguments || '{}');
        const actionId = toolCall.id || `${requestId}-${toolName}-${step}`;
        const argsText = JSON.stringify(args);

        this.emitAction(sender, requestId, {
          id: actionId,
          toolName,
          args: argsText,
          status: 'running',
        });
        
        const result = await this.executeTool(toolName, args, workspaceRoot, settings.permissionMode);
        
        this.emitAction(sender, requestId, {
          id: actionId,
          toolName,
          args: argsText,
          status: result.ok ? 'ok' : 'error',
          output: result.output,
        });

        conversation.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    this.emitChunk(sender, requestId, '\n\nAgent dừng vì đạt giới hạn số bước. Hãy thu hẹp yêu cầu hoặc chạy tiếp.');
    sender.send('ai:chat:done', { requestId });
  }

  private buildAgentSystemPrompt(workspaceRoot: string, permissionMode: PermissionMode) {
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
      'If earlier context was compacted, treat its summary as lossy. Re-read files or rerun lightweight checks when exact details matter.',
    ].join('\n');
  }

  private getInputContextTokenBudget(contextWindow: number | undefined) {
    if (!this.isUsableContextWindow(contextWindow)) return DEFAULT_INPUT_CONTEXT_TOKENS;

    const responseTokens = this.getResponseTokenLimit(contextWindow);
    const overheadTokens = Math.min(4_000, Math.max(800, Math.floor(contextWindow * 0.05)));
    return Math.max(1_000, contextWindow - responseTokens - overheadTokens);
  }

  private getResponseTokenLimit(contextWindow: number | undefined) {
    if (!this.isUsableContextWindow(contextWindow)) return MAX_RESPONSE_TOKENS;
    return Math.min(MAX_RESPONSE_TOKENS, Math.max(1_024, Math.floor(contextWindow * 0.25)));
  }

  private isUsableContextWindow(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 2_048;
  }

  private async formatMessages(messages: Message[]): Promise<ChatMessage[]> {
    const formattedMessages: ChatMessage[] = [];

    for (const message of messages) {
      if (!Array.isArray(message.attachments) || message.attachments.length === 0) {
        formattedMessages.push({
          role: message.sender === 'user' ? 'user' : 'assistant',
          content: message.content,
        });
        continue;
      }

      const parts: Array<Record<string, unknown>> = [];
      for (const attachment of message.attachments) {
        if (attachment.type === 'image') {
          const imageUrl = await this.readAttachmentImageUrl(attachment);
          if (imageUrl) {
            parts.push({ type: 'image_url', image_url: { url: imageUrl } });
          } else {
            parts.push({ type: 'text', text: this.describeAttachment(attachment) });
          }
        } else if (attachment.type === 'text') {
          parts.push({ type: 'text', text: await this.readAttachmentText(attachment) });
        } else {
          parts.push({ type: 'text', text: this.describeAttachment(attachment) });
        }
      }

      if (message.content) {
        parts.push({ type: 'text', text: message.content });
      }

      formattedMessages.push({
        role: message.sender === 'user' ? 'user' : 'assistant',
        content: parts,
      });
    }

    return formattedMessages;
  }

  private async readAttachmentText(attachment: Attachment) {
    if (attachment.data) {
      return `[File: ${attachment.name}]\n\`\`\`\n${attachment.data}\n\`\`\``;
    }

    if (!attachment.filePath) {
      return this.describeAttachment(attachment);
    }

    try {
      const stat = await fs.stat(attachment.filePath);
      if (!stat.isFile()) return `${this.describeAttachment(attachment)}\nPath is not a file.`;
      if (stat.size > MAX_FILE_BYTES) {
        return `${this.describeAttachment(attachment)}\nFile is too large to inline (${stat.size} bytes). Read it with tools only if needed.`;
      }

      return `[File: ${attachment.name}]\nPath: ${attachment.filePath}\n\`\`\`\n${await fs.readFile(attachment.filePath, 'utf8')}\n\`\`\``;
    } catch (error) {
      return `${this.describeAttachment(attachment)}\nCould not read file: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  private async readAttachmentImageUrl(attachment: Attachment) {
    if (attachment.data) return attachment.data;
    if (!attachment.filePath) return '';

    try {
      const stat = await fs.stat(attachment.filePath);
      if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) return '';
      const mimeType = attachment.mimeType || this.inferMimeType(attachment.name) || 'image/png';
      const data = await fs.readFile(attachment.filePath);
      return `data:${mimeType};base64,${data.toString('base64')}`;
    } catch {
      return '';
    }
  }

  private describeAttachment(attachment: Attachment) {
    return [
      `[${attachment.type} attachment: ${attachment.name}]`,
      attachment.filePath ? `Path: ${attachment.filePath}` : '',
      attachment.size ? `Size: ${attachment.size} bytes` : '',
      attachment.mimeType ? `MIME: ${attachment.mimeType}` : '',
    ].filter(Boolean).join('\n');
  }

  private inferMimeType(fileName: string) {
    const extension = path.extname(fileName).toLowerCase();
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
    if (extension === '.png') return 'image/png';
    if (extension === '.gif') return 'image/gif';
    if (extension === '.webp') return 'image/webp';
    return '';
  }

  private parseToolArguments(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  private readAssistantContent(message: ChatMessage) {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content.map((part) => typeof part === 'object' && part !== null && typeof part.text === 'string' ? part.text : '').join('');
    }
    return '';
  }

  private emitChunk(sender: WebContents, requestId: string, chunk: string) {
    if (chunk) {
      sender.send('ai:chat:chunk', { requestId, chunk });
    }
  }

  private emitAction(sender: WebContents, requestId: string, action: AgentActionPayload) {
    sender.send('ai:chat:action', { requestId, action });
  }

  private async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
  ): Promise<ToolResult> {
    try {
      if (toolName === 'list_files') {
        return await this.listFiles(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'read_file') {
        return await this.readFileTool(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'write_file') {
        return await this.writeFileTool(args, workspaceRoot, permissionMode);
      }
      if (toolName === 'run_command') {
        return await this.runCommandTool(args, workspaceRoot, permissionMode);
      }

      return { ok: false, output: `Unknown tool: ${toolName}` };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Unknown tool error' };
    }
  }

  private getString(value: unknown) {
    return typeof value === 'string' ? value : '';
  }

  private async listFiles(args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode): Promise<ToolResult> {
    const dir = this.resolvePath(this.getString(args.dir) || '.', workspaceRoot, permissionMode);
    const maxEntries = Math.min(Math.max(Number(args.maxEntries) || 200, 1), 500);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const visibleEntries = entries
      .filter((entry) => !['node_modules', '.git', 'dist', 'dist-electron'].includes(entry.name))
      .slice(0, maxEntries)
      .map((entry) => `${entry.isDirectory() ? 'dir ' : 'file'} ${entry.name}`)
      .join('\n');

    return { ok: true, output: visibleEntries || '(empty)' };
  }

  private async readFileTool(args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode): Promise<ToolResult> {
    const filePath = this.resolvePath(this.getString(args.path), workspaceRoot, permissionMode);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return { ok: false, output: 'Path is not a file.' };
    }
    if (stat.size > MAX_FILE_BYTES) {
      return { ok: false, output: `File too large (${stat.size} bytes). Limit is ${MAX_FILE_BYTES} bytes.` };
    }

    return { ok: true, output: await fs.readFile(filePath, 'utf8') };
  }

  private async writeFileTool(args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode): Promise<ToolResult> {
    if (permissionMode === 'read-only') {
      return { ok: false, output: 'write_file is blocked in read-only mode.' };
    }

    const filePath = this.resolvePath(this.getString(args.path), workspaceRoot, permissionMode);
    const content = this.getString(args.content);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    return { ok: true, output: `Wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${path.relative(workspaceRoot, filePath) || filePath}.` };
  }

  private async runCommandTool(args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode): Promise<ToolResult> {
    if (permissionMode === 'read-only') {
      return { ok: false, output: 'run_command is blocked in read-only mode.' };
    }

    const command = this.getString(args.command).trim();
    if (!command) {
      return { ok: false, output: 'Command is empty.' };
    }

    const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || 15_000, 1_000), 30_000);
    return this.runSandboxedCommand(command, workspaceRoot, permissionMode, timeoutMs);
  }

  private async runSandboxedCommand(
    command: string,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    timeoutMs: number,
  ): Promise<ToolResult> {
    if (permissionMode === 'danger-full-access') {
      return this.spawnAndCollect('/bin/sh', ['-lc', command], workspaceRoot, timeoutMs);
    }

    if (process.platform === 'darwin') {
      const sandboxExec = '/usr/bin/sandbox-exec';
      if (!await this.fileExists(sandboxExec)) {
        return { ok: false, output: 'sandbox-exec not found; refusing to run command in workspace-write mode.' };
      }

      const profile = this.buildSeatbeltProfile(workspaceRoot);
      return this.spawnAndCollect(sandboxExec, ['-p', profile, '/bin/sh', '-lc', command], workspaceRoot, timeoutMs);
    }

    if (process.platform === 'linux') {
      if (!await this.commandExists('bwrap')) {
        return { ok: false, output: 'bubblewrap (bwrap) not found; refusing to run command in workspace-write mode.' };
      }

      return this.spawnAndCollect('bwrap', [
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

  private buildSeatbeltProfile(workspaceRoot: string) {
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

  private spawnAndCollect(command: string, args: string[], cwd: string, timeoutMs: number): Promise<ToolResult> {
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
        resolve({ ok: false, output: this.trimOutput(`${output}\nCommand timed out after ${timeoutMs}ms.`) });
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8');
        output = this.trimOutput(output);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8');
        output = this.trimOutput(output);
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
          output: this.trimOutput(`${output}\nExit code: ${code ?? 'unknown'}`),
        });
      });
    });
  }

  private resolvePath(inputPath: string, workspaceRoot: string, permissionMode: PermissionMode) {
    if (!inputPath) {
      throw new Error('Path is required.');
    }

    const resolved = path.resolve(permissionMode === 'danger-full-access' && path.isAbsolute(inputPath)
      ? inputPath
      : path.join(workspaceRoot, inputPath));

    if (permissionMode !== 'danger-full-access' && !this.isInsidePath(resolved, workspaceRoot)) {
      throw new Error(`Path escapes workspace: ${inputPath}`);
    }

    return resolved;
  }

  private isInsidePath(candidate: string, root: string) {
    const relative = path.relative(root, candidate);
    return relative === '' || Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  private trimOutput(output: string) {
    if (output.length <= MAX_COMMAND_OUTPUT) return output;
    return `${output.slice(0, MAX_COMMAND_OUTPUT)}\n[output truncated]`;
  }

  private async fileExists(filePath: string) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async commandExists(command: string) {
    const pathEntries = (process.env.PATH || '').split(path.delimiter);
    for (const entry of pathEntries) {
      if (await this.fileExists(path.join(entry, command))) return true;
    }
    return false;
  }
}
