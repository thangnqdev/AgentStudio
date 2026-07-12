import { ipcMain } from 'electron';
import type { SaveMcpServerInput } from '../domain/entities/mcp.js';
import { mcpServerManager } from '../mcpRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function respond<T>(task: () => Promise<T>) {
  return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({
    success: false as const,
    error: error instanceof Error ? error.message : 'MCP operation failed.',
  }));
}

export function registerMcpIpc() {
  ipcMain.handle('mcp:list', () => respond(() => mcpServerManager.list()));
  ipcMain.handle('mcp:save', (_event, rawPayload: unknown) => respond(async () => mcpServerManager.save(readServerInput(rawPayload), await workspaceManager.getWorkspaceRoot())));
  ipcMain.handle('mcp:remove', (_event, rawServerId: unknown) => respond(() => mcpServerManager.remove(readId(rawServerId))));
  ipcMain.handle('mcp:start', (_event, rawServerId: unknown) => respond(async () => mcpServerManager.start(readId(rawServerId), await workspaceManager.getWorkspaceRoot())));
  ipcMain.handle('mcp:stop', (_event, rawServerId: unknown) => respond(() => mcpServerManager.stop(readId(rawServerId))));
}

function readServerInput(value: unknown): SaveMcpServerInput {
  if (!isObject(value) || !isObject(value.transport)) throw new Error('Invalid MCP server payload.');
  const type = value.transport.type;
  const transport = type === 'stdio'
    ? {
      type: 'stdio' as const,
      command: typeof value.transport.command === 'string' ? value.transport.command : '',
      args: Array.isArray(value.transport.args) ? value.transport.args.filter((arg): arg is string => typeof arg === 'string') : [],
    }
    : type === 'http'
      ? { type: 'http' as const, url: typeof value.transport.url === 'string' ? value.transport.url : '' }
      : null;
  if (!transport) throw new Error('Unsupported MCP transport.');
  const credentials = isObject(value.credentials) ? {
    bearerToken: typeof value.credentials.bearerToken === 'string' ? value.credentials.bearerToken : undefined,
    oauthClientId: typeof value.credentials.oauthClientId === 'string' ? value.credentials.oauthClientId : undefined,
    oauthClientSecret: typeof value.credentials.oauthClientSecret === 'string' ? value.credentials.oauthClientSecret : undefined,
    oauthScope: typeof value.credentials.oauthScope === 'string' ? value.credentials.oauthScope : undefined,
    environment: isObject(value.credentials.environment)
      ? Object.fromEntries(Object.entries(value.credentials.environment).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : undefined,
  } : undefined;
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    name: typeof value.name === 'string' ? value.name : '',
    transport,
    autoStart: value.autoStart === true,
    defaultRisk: value.defaultRisk === 'read' || value.defaultRisk === 'write' || value.defaultRisk === 'network' ? value.defaultRisk : 'execute',
    credentials,
    clearCredentials: value.clearCredentials === true,
  };
}

function readId(value: unknown) {
  if (typeof value !== 'string' || !value) throw new Error('serverId is required.');
  return value;
}
