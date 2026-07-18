import { ipcMain } from 'electron';
import type { SaveMcpServerInput } from '../domain/entities/mcp.js';
import { mcpServerManager, mcpSettingsAuthentication } from '../mcpRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  ipcMain.handle('mcp:authenticate', (_event, rawServerId: unknown) => respond(async () => (
    mcpSettingsAuthentication.execute(readId(rawServerId), await workspaceManager.getWorkspaceRoot())
  )));
}

function readServerInput(value: unknown): SaveMcpServerInput {
  if (!isObject(value) || !isObject(value.transport)) throw new Error('Invalid MCP server payload.');
  assertOnlyKeys(value, ['id', 'name', 'transport', 'autoStart', 'defaultRisk', 'credentials', 'clearCredentials']);
  const type = value.transport.type;
  const transport = type === 'stdio'
    ? readStdioTransport(value.transport)
    : type === 'http'
      ? readHttpTransport(value.transport)
      : null;
  if (!transport) throw new Error('Unsupported MCP transport.');
  const credentials = value.credentials === undefined ? undefined : readCredentials(value.credentials);
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
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value)) throw new Error('serverId is invalid.');
  return value;
}

function readStdioTransport(value: Record<string, unknown>) {
  assertOnlyKeys(value, ['type', 'command', 'args']);
  if (typeof value.command !== 'string' || !Array.isArray(value.args) || value.args.some((arg) => typeof arg !== 'string')) {
    throw new Error('Invalid MCP stdio transport.');
  }
  return { type: 'stdio' as const, command: value.command, args: value.args as string[] };
}

function readHttpTransport(value: Record<string, unknown>) {
  assertOnlyKeys(value, ['type', 'url']);
  if (typeof value.url !== 'string') throw new Error('Invalid MCP HTTP transport.');
  return { type: 'http' as const, url: value.url };
}

function readCredentials(value: unknown) {
  if (!isObject(value)) throw new Error('Invalid MCP credentials.');
  assertOnlyKeys(value, ['bearerToken', 'oauthClientId', 'oauthClientSecret', 'oauthScope', 'environment']);
  const optional = (field: string) => value[field] === undefined ? undefined : typeof value[field] === 'string' ? value[field] as string : invalidCredentials();
  let environment: Record<string, string> | undefined;
  if (value.environment !== undefined) {
    if (!isObject(value.environment) || Object.values(value.environment).some((item) => typeof item !== 'string')) invalidCredentials();
    environment = value.environment as Record<string, string>;
  }
  return {
    bearerToken: optional('bearerToken'), oauthClientId: optional('oauthClientId'),
    oauthClientSecret: optional('oauthClientSecret'), oauthScope: optional('oauthScope'), environment,
  };
}

function invalidCredentials(): never { throw new Error('Invalid MCP credentials.'); }
function assertOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const keys = new Set(allowed); if (Object.keys(value).some((key) => !keys.has(key))) throw new Error('MCP payload contains unknown fields.');
}
