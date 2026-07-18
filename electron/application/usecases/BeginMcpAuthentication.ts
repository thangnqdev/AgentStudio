import { toPublicMcpServerConfig } from '../../domain/entities/mcp.js';
import type { McpAuthOutput } from '../../domain/entities/mcpAuth.js';
import type { IMcpAuthSessionGateway } from '../../domain/ports/IMcpAuthSessionGateway.js';
import type { IMcpConnectionGateway } from '../../domain/ports/IMcpConnectionGateway.js';
import type { IMcpServerRepository } from '../../domain/ports/IMcpServerRepository.js';

export class BeginMcpAuthentication {
  private readonly sessions: IMcpAuthSessionGateway;
  private readonly repository: IMcpServerRepository;
  private readonly connections: IMcpConnectionGateway;

  constructor(sessions: IMcpAuthSessionGateway, repository: IMcpServerRepository, connections: IMcpConnectionGateway) {
    this.sessions = sessions; this.repository = repository; this.connections = connections;
  }

  async execute(serverId: string, workspaceRoot: string): Promise<McpAuthOutput> {
    const server = (await this.repository.loadAll()).find((candidate) => candidate.id === serverId);
    if (!server) throw new Error('MCP server does not exist.');
    if (server.transport.type !== 'http') {
      return { status: 'unsupported', message: `Server "${server.name}" does not support interactive OAuth.` };
    }
    const session = await this.sessions.begin({
      serverId: server.id, serverName: server.name, serverUrl: server.transport.url,
      scope: server.credentials.oauthScope,
    });
    void session.completion.then(async () => {
      const latest = (await this.repository.loadAll()).find((candidate) => candidate.id === serverId);
      if (latest) await this.connections.start(toPublicMcpServerConfig(latest), latest.credentials, workspaceRoot);
    }).catch(() => undefined);
    if (session.status === 'completed') {
      return { status: 'auth_url', message: `Authentication completed for ${server.name}. Its tools will become available automatically.` };
    }
    return {
      status: 'auth_url', authUrl: session.authorizationUrl,
      message: `Ask the user to open this URL in their browser to authorize the ${server.name} MCP server:\n\n${session.authorizationUrl}\n\nOnce completed, the server reconnects automatically.`,
    };
  }
}
