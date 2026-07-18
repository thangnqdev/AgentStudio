import path from 'node:path';
import { app } from 'electron';
import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import type { McpCredentials, McpServerConfig } from '../../domain/entities/mcp.js';
import type { IMcpConnectionGateway } from '../../domain/ports/IMcpConnectionGateway.js';
import type { IMcpAuthSessionGateway } from '../../domain/ports/IMcpAuthSessionGateway.js';
import type { IMcpResourceArtifactStore } from '../../domain/ports/IMcpResourceArtifactStore.js';
import type { IToolPlatformDecorator } from '../../domain/ports/IToolPlatformDecorator.js';
import type { IMcpAuthenticationGateway } from '../../domain/ports/IMcpAuthenticationGateway.js';
import { McpResourceToolPlatform } from '../../application/services/McpResourceToolPlatform.js';
import { McpAuthToolPlatform } from '../../application/services/McpAuthToolPlatform.js';
import { BeginMcpAuthentication } from '../../application/usecases/BeginMcpAuthentication.js';
import { ListMcpResources } from '../../application/usecases/ListMcpResources.js';
import { ReadMcpResource } from '../../application/usecases/ReadMcpResource.js';
import { McpConnectionRegistry } from './McpConnectionRegistry.js';
import { McpRemoteToolPlatform } from './McpRemoteToolPlatform.js';
import { McpResourceCache } from './McpResourceCache.js';
import { McpSdkResourceGateway } from './McpSdkResourceGateway.js';
import { PrivateMcpResourceArtifactStore } from './PrivateMcpResourceArtifactStore.js';
import { EncryptedMcpOAuthCredentialStore } from './EncryptedMcpOAuthCredentialStore.js';
import { JsonMcpServerRepository } from './JsonMcpServerRepository.js';
import { LoopbackMcpAuthSessionGateway } from './LoopbackMcpAuthSessionGateway.js';
import type { IIdeContextSink } from '../../domain/ports/IIdeContextSink.js';

export class McpClientGateway implements IMcpConnectionGateway, IMcpAuthenticationGateway, IToolPlatformDecorator {
  private readonly registry: McpConnectionRegistry;
  private readonly platform: McpAuthToolPlatform;
  private readonly resourcePlatform: McpResourceToolPlatform;
  private readonly authSessions: IMcpAuthSessionGateway;
  private readonly authenticator: BeginMcpAuthentication;

  constructor(
    artifacts?: IMcpResourceArtifactStore,
    repository: JsonMcpServerRepository = new JsonMcpServerRepository(),
    authSessions?: IMcpAuthSessionGateway,
    ideSelections?: IIdeContextSink,
  ) {
    const cache = new McpResourceCache();
    const oauthStore = new EncryptedMcpOAuthCredentialStore(repository);
    this.registry = new McpConnectionRegistry(cache, oauthStore, ideSelections);
    const remoteTools = new McpRemoteToolPlatform(this.registry);
    const resourceGateway = new McpSdkResourceGateway(this.registry, cache);
    const artifactStore = artifacts ?? new PrivateMcpResourceArtifactStore(
      () => path.join(app.getPath('userData'), 'mcp-resource-artifacts'),
    );
    this.resourcePlatform = new McpResourceToolPlatform(
      remoteTools, remoteTools,
      new ListMcpResources(resourceGateway),
      new ReadMcpResource(resourceGateway, artifactStore),
      artifactStore,
    );
    this.authSessions = authSessions ?? new LoopbackMcpAuthSessionGateway(oauthStore);
    this.authenticator = new BeginMcpAuthentication(this.authSessions, repository, this);
    this.platform = new McpAuthToolPlatform(this.resourcePlatform, this.resourcePlatform, this.registry, this.authenticator);
  }

  start(config: McpServerConfig, credentials: McpCredentials, workspaceRoot: string) {
    return this.registry.start(config, credentials, workspaceRoot);
  }

  async stop(serverId: string) { await this.authSessions.cancel(serverId); await this.registry.stop(serverId); }
  async forget(serverId: string) { await this.authSessions.cancel(serverId); await this.registry.forget(serverId); }
  async stopAll() { await this.authSessions.cancelAll(); await this.registry.stopAll(); }
  getStatus(config: McpServerConfig) { return this.registry.getStatus(config); }
  authenticate(serverId: string, workspaceRoot: string) { return this.authenticator.execute(serverId, workspaceRoot); }
  list(workspaceRoot: string) { return this.platform.list(workspaceRoot); }
  decorateTools(tools: Parameters<IToolPlatformDecorator['decorateTools']>[0]) { return this.resourcePlatform.decorateTools(tools); }
  interceptsTool(toolName: string, args: Record<string, unknown>) { return this.resourcePlatform.interceptsTool(toolName, args); }

  execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal): Promise<ToolResult> {
    return this.platform.execute(toolName, args, workspaceRoot, permissionMode, signal);
  }
}
