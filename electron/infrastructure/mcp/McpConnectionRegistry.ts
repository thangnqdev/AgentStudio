import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { UnauthorizedError, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { ClientCredentialsProvider } from '@modelcontextprotocol/sdk/client/auth-extensions.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpConnectionState, McpCredentials, McpServerConfig } from '../../domain/entities/mcp.js';
import type { McpAuthServer } from '../../domain/entities/mcpAuth.js';
import type { McpResourceServer } from '../../domain/entities/mcpResource.js';
import type { IMcpAuthServerSource } from '../../domain/ports/IMcpAuthServerSource.js';
import type { IMcpOAuthCredentialStore } from '../../domain/ports/IMcpOAuthCredentialStore.js';
import type { McpConnectionSource, McpSdkConnection } from './McpConnectionSource.js';
import { discoverRemoteTools } from './McpRemoteToolPlatform.js';
import type { McpResourceCache } from './McpResourceCache.js';
import { McpInteractiveAuthorizationRequiredError, McpSdkOAuthProvider } from './McpSdkOAuthProvider.js';
import { parseIdeAtMentionedNotification, parseIdeSelectionChangedNotification } from '../../domain/entities/ideSelection.js';
import type { IIdeContextSink } from '../../domain/ports/IIdeContextSink.js';

export class McpConnectionRegistry implements McpConnectionSource, IMcpAuthServerSource {
  private readonly connections = new Map<string, McpSdkConnection>();
  private readonly activeClients = new Map<string, Client>();
  private readonly configs = new Map<string, McpServerConfig>();
  private readonly states = new Map<string, { state: McpConnectionState; error?: string }>();
  private readonly resourceCache: McpResourceCache;
  private readonly oauthStore?: IMcpOAuthCredentialStore;
  private readonly ideSelections?: IIdeContextSink;

  constructor(resourceCache: McpResourceCache, oauthStore?: IMcpOAuthCredentialStore, ideSelections?: IIdeContextSink) {
    this.resourceCache = resourceCache;
    this.oauthStore = oauthStore;
    this.ideSelections = ideSelections;
  }

  async start(config: McpServerConfig, credentials: McpCredentials, workspaceRoot: string) {
    await this.stop(config.id);
    this.configs.set(config.id, config);
    this.states.set(config.id, { state: 'starting' });
    let client: Client | undefined;
    try {
      client = new Client({ name: 'agent-studio', version: '0.6.0' }, {
        capabilities: {},
        listChanged: { resources: {
          onChanged: (error, resources) => {
            if (this.connections.get(config.id)?.client !== client) return;
            if (error || !resources) this.resourceCache.delete(config.id);
            else this.resourceCache.set(config.id, resources);
          },
        } },
      });
      this.activeClients.set(config.id, client);
      client.fallbackNotificationHandler = async (notification) => {
        if (config.name.trim().toLowerCase() !== 'ide') return;
        if (this.activeClients.get(config.id) !== client) return;
        const selection = parseIdeSelectionChangedNotification(notification);
        if (selection) this.ideSelections?.publishSelection(config.id, selection);
        const mention = parseIdeAtMentionedNotification(notification);
        if (mention) this.ideSelections?.publishAtMention(config.id, mention);
      };
      const authProvider = this.createAuthProvider(config, credentials);
      const transport = config.transport.type === 'stdio'
        ? new StdioClientTransport({
          command: config.transport.command, args: config.transport.args, cwd: workspaceRoot,
          env: { ...getDefaultEnvironment(), ...credentials.environment }, stderr: 'ignore',
        })
        : new StreamableHTTPClientTransport(new URL(config.transport.url), {
          authProvider,
          requestInit: credentials.bearerToken && !authProvider
            ? { headers: { Authorization: `Bearer ${credentials.bearerToken}` } } : undefined,
        });
      await client.connect(transport, { timeout: 15_000 });
      const connectedClient = client;
      const connection: McpSdkConnection = {
        client: connectedClient, config,
        capabilities: connectedClient.getServerCapabilities() ?? {},
        tools: await discoverRemoteTools(connectedClient, config),
      };
      this.connections.set(config.id, connection);
      connectedClient.onclose = () => this.handleClose(config.id, connectedClient);
      connectedClient.onerror = (error) => {
        if (this.connections.get(config.id)?.client === connectedClient) this.states.set(config.id, { state: 'error', error: error.message });
      };
      this.states.set(config.id, { state: 'connected' });
      await this.prefetchResources(connection);
    } catch (error) {
      await client?.close().catch(() => undefined);
      if (this.activeClients.get(config.id) === client) this.activeClients.delete(config.id);
      this.connections.delete(config.id);
      this.resourceCache.delete(config.id);
      if (config.transport.type === 'http' && isAuthenticationRequired(error)) {
        this.states.set(config.id, { state: 'needs-auth' });
        return;
      }
      this.states.set(config.id, { state: 'error', error: error instanceof Error ? error.message : 'MCP connection failed.' });
      throw error;
    }
  }

  async stop(serverId: string) {
    const connection = this.connections.get(serverId);
    this.connections.delete(serverId);
    this.activeClients.delete(serverId);
    this.resourceCache.delete(serverId);
    this.ideSelections?.clear(serverId);
    this.states.set(serverId, { state: 'stopped' });
    if (connection) await connection.client.close().catch(() => undefined);
  }

  async forget(serverId: string) {
    await this.stop(serverId);
    this.configs.delete(serverId);
    this.states.delete(serverId);
  }

  async stopAll() {
    await Promise.all([...this.connections.keys()].map((serverId) => this.stop(serverId)));
  }

  getStatus(config: McpServerConfig) {
    this.configs.set(config.id, config);
    const state = this.states.get(config.id) ?? { state: 'stopped' as const };
    return { ...config, ...state, toolCount: this.connections.get(config.id)?.tools.size ?? 0 };
  }

  getConnection(serverId: string) { return this.connections.get(serverId); }
  listConnections() { return [...this.connections.values()]; }

  listResourceServers(): McpResourceServer[] {
    return [...this.configs.values()].map((config) => ({
      id: config.id, name: config.name,
      state: this.states.get(config.id)?.state ?? 'stopped',
      supportsResources: Boolean(this.connections.get(config.id)?.capabilities.resources),
    }));
  }

  listAuthServers(): McpAuthServer[] {
    return [...this.configs.values()].map((config) => ({
      id: config.id, name: config.name, state: this.states.get(config.id)?.state ?? 'stopped',
      transport: config.transport.type,
      ...(config.transport.type === 'http' ? { url: config.transport.url } : {}),
    }));
  }

  private createAuthProvider(config: McpServerConfig, credentials: McpCredentials): OAuthClientProvider | undefined {
    const interactive = credentials.interactiveOAuth;
    if (config.transport.type === 'http' && interactive?.redirectUrl && this.oauthStore) {
      return new McpSdkOAuthProvider({
        serverId: config.id, redirectUrl: interactive.redirectUrl, state: randomUUID(),
        scope: credentials.oauthScope, store: this.oauthStore,
        onRedirect: () => { throw new McpInteractiveAuthorizationRequiredError(); },
      });
    }
    return credentials.oauthClientId && credentials.oauthClientSecret
      ? new ClientCredentialsProvider({
        clientId: credentials.oauthClientId, clientSecret: credentials.oauthClientSecret,
        scope: credentials.oauthScope, clientName: 'AgentStudio',
      })
      : undefined;
  }

  private handleClose(serverId: string, client: Client) {
    if (this.activeClients.get(serverId) !== client) return;
    this.activeClients.delete(serverId);
    if (this.connections.get(serverId)?.client === client) this.connections.delete(serverId);
    this.resourceCache.delete(serverId);
    this.ideSelections?.clear(serverId);
    if (this.states.get(serverId)?.state === 'connected') this.states.set(serverId, { state: 'stopped' });
  }

  private async prefetchResources(connection: McpSdkConnection) {
    if (!connection.capabilities.resources) return;
    try {
      const result = await connection.client.listResources(undefined, { timeout: 15_000 });
      this.resourceCache.set(connection.config.id, result.resources);
    } catch {
      this.resourceCache.delete(connection.config.id);
    }
  }
}

function isAuthenticationRequired(error: unknown) {
  return error instanceof UnauthorizedError
    || error instanceof McpInteractiveAuthorizationRequiredError
    || (error instanceof Error && 'code' in error && error.code === 401);
}
