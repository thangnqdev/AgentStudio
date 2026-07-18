import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import { buildMcpAuthToolDefinition, buildMcpAuthToolName, type McpAuthOutput } from '../../domain/entities/mcpAuth.js';
import type { IMcpAuthServerSource } from '../../domain/ports/IMcpAuthServerSource.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { BeginMcpAuthentication } from '../usecases/BeginMcpAuthentication.js';

export class McpAuthToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly servers: IMcpAuthServerSource;
  private readonly beginAuthentication: BeginMcpAuthentication;

  constructor(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor, servers: IMcpAuthServerSource, beginAuthentication: BeginMcpAuthentication) {
    this.baseCatalog = baseCatalog; this.baseExecutor = baseExecutor;
    this.servers = servers; this.beginAuthentication = beginAuthentication;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    const definitions = this.servers.listAuthServers()
      .filter((server) => server.state === 'needs-auth')
      .map(buildMcpAuthToolDefinition);
    const names = new Set(definitions.map((tool) => tool.name));
    return [...tools.filter((tool) => !names.has(tool.name)), ...definitions];
  }

  async execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal): Promise<ToolResult> {
    const server = this.servers.listAuthServers().find((candidate) => (
      candidate.state === 'needs-auth' && buildMcpAuthToolName(candidate.name) === toolName
    ));
    if (!server) return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    try {
      return { ok: true, output: JSON.stringify(await this.beginAuthentication.execute(server.id, workspaceRoot)) };
    } catch {
      const output: McpAuthOutput = {
        status: 'error',
        message: `Failed to start OAuth for ${server.name}. Ask the user to authenticate from MCP settings.`,
      };
      return { ok: true, output: JSON.stringify(output) };
    }
  }
}
