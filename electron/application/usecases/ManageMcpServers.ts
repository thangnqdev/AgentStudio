import { randomUUID } from 'node:crypto';
import type { McpCredentials, McpServerRecord, SaveMcpServerInput } from '../../domain/entities/mcp.js';
import type { ToolRisk } from '../../domain/entities/tool.js';
import type { IMcpConnectionGateway } from '../../domain/ports/IMcpConnectionGateway.js';
import type { IMcpServerRepository } from '../../domain/ports/IMcpServerRepository.js';

export class ManageMcpServers {
  private readonly repository: IMcpServerRepository;
  private readonly gateway: IMcpConnectionGateway;

  constructor(
    repository: IMcpServerRepository,
    gateway: IMcpConnectionGateway,
  ) {
    this.repository = repository;
    this.gateway = gateway;
  }

  async list() {
    return (await this.repository.loadAll()).map((server) => this.gateway.getStatus(toPublicConfig(server)));
  }

  async save(input: SaveMcpServerInput, workspaceRoot: string) {
    const existing = input.id ? (await this.repository.loadAll()).find((server) => server.id === input.id) : undefined;
    const record = normalizeServer(input, existing);
    const wasConnected = existing ? this.gateway.getStatus(toPublicConfig(existing)).state === 'connected' : false;
    await this.repository.save(record);
    if (wasConnected) await this.gateway.start(toPublicConfig(record), record.credentials, workspaceRoot);
    return this.list();
  }

  async remove(serverId: string) {
    await this.gateway.stop(serverId);
    await this.repository.remove(serverId);
    return this.list();
  }

  async start(serverId: string, workspaceRoot: string) {
    const server = await this.get(serverId);
    await this.gateway.start(toPublicConfig(server), server.credentials, workspaceRoot);
    return this.list();
  }

  async stop(serverId: string) {
    await this.gateway.stop(serverId);
    return this.list();
  }

  async startAuto(workspaceRoot: string) {
    const servers = (await this.repository.loadAll()).filter((server) => server.autoStart);
    await Promise.allSettled(servers.map((server) => this.gateway.start(toPublicConfig(server), server.credentials, workspaceRoot)));
  }

  stopAll() {
    return this.gateway.stopAll();
  }

  private async get(serverId: string) {
    const server = (await this.repository.loadAll()).find((item) => item.id === serverId);
    if (!server) throw new Error('MCP server does not exist.');
    return server;
  }
}

function normalizeServer(input: SaveMcpServerInput, existing?: McpServerRecord): McpServerRecord {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error('MCP server name is required.');
  const defaultRisk = normalizeRisk(input.defaultRisk);
  const credentials = normalizeCredentials(input.clearCredentials ? {} : input.credentials ?? existing?.credentials ?? {});
  const transport = input.transport.type === 'stdio'
    ? normalizeStdio(input.transport.command, input.transport.args)
    : normalizeHttp(input.transport.url);
  return {
    id: existing?.id ?? randomUUID(),
    name,
    transport,
    autoStart: input.autoStart === true,
    defaultRisk,
    hasCredentials: Boolean(credentials.bearerToken || credentials.oauthClientSecret || Object.keys(credentials.environment ?? {}).length),
    credentials,
  };
}

function normalizeStdio(command: string, args: string[]) {
  const normalizedCommand = command.trim();
  if (!normalizedCommand || normalizedCommand.includes('\0')) throw new Error('A valid stdio command is required.');
  if (args.length > 40 || args.some((arg) => arg.length > 2_000 || arg.includes('\0'))) throw new Error('Invalid stdio arguments.');
  return { type: 'stdio' as const, command: normalizedCommand, args: [...args] };
}

function normalizeHttp(rawUrl: string) {
  const url = new URL(rawUrl.trim());
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) throw new Error('Remote MCP servers require HTTPS; HTTP is only allowed for localhost.');
  if (url.username || url.password) throw new Error('Put credentials in the credential fields, not in the URL.');
  return { type: 'http' as const, url: url.toString() };
}

function normalizeCredentials(credentials: McpCredentials): McpCredentials {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(credentials.environment ?? {}).slice(0, 30)) {
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key) || typeof value !== 'string' || value.length > 4_096) throw new Error(`Invalid MCP environment credential: ${key}`);
    environment[key] = value;
  }
  const oauthClientId = credentials.oauthClientId?.trim().slice(0, 1_024);
  const oauthClientSecret = credentials.oauthClientSecret?.slice(0, 8_192);
  if (Boolean(oauthClientId) !== Boolean(oauthClientSecret)) throw new Error('OAuth client id and client secret must be provided together.');
  if (credentials.bearerToken && oauthClientId) throw new Error('Choose either a static bearer token or OAuth client credentials, not both.');
  return {
    bearerToken: credentials.bearerToken?.slice(0, 8_192),
    oauthClientId,
    oauthClientSecret,
    oauthScope: credentials.oauthScope?.trim().slice(0, 1_024),
    environment,
  };
}

function normalizeRisk(risk: ToolRisk | undefined): ToolRisk {
  return risk === 'read' || risk === 'write' || risk === 'network' ? risk : 'execute';
}

function toPublicConfig(server: McpServerRecord) {
  const { credentials: _credentials, ...config } = server;
  return config;
}
