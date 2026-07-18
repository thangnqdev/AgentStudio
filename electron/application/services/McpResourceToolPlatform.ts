import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import {
  DEFAULT_MCP_ARTIFACT_READ_CHARACTERS,
  LIST_MCP_RESOURCES_TOOL_NAME,
  MAX_MCP_ARTIFACT_OFFSET_CHARACTERS,
  MAX_MCP_ARTIFACT_READ_CHARACTERS,
  MAX_MCP_RESOURCE_RESULT_CHARACTERS,
  MCP_RESOURCE_TOOL_DEFINITIONS,
  READ_MCP_RESOURCE_TOOL_NAME,
} from '../../domain/entities/mcpResource.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { IMcpResourceArtifactStore } from '../../domain/ports/IMcpResourceArtifactStore.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { IToolPlatformDecorator } from '../../domain/ports/IToolPlatformDecorator.js';
import type { ListMcpResources } from '../usecases/ListMcpResources.js';
import type { ReadMcpResource } from '../usecases/ReadMcpResource.js';

const EMPTY_RESOURCE_MESSAGE = 'No resources found. MCP servers may still provide tools even if they have no resources.';

const ARTIFACT_READ_DESCRIPTION = `Private MCP JSON/text artifacts returned by resource tools support offset and limit chunks of at most ${MAX_MCP_ARTIFACT_READ_CHARACTERS} characters.`;

export class McpResourceToolPlatform implements IToolCatalog, IToolExecutor, IToolPlatformDecorator {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly listResources: ListMcpResources;
  private readonly readResource: ReadMcpResource;
  private readonly artifacts: IMcpResourceArtifactStore;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    listResources: ListMcpResources,
    readResource: ReadMcpResource,
    artifacts: IMcpResourceArtifactStore,
  ) {
    this.baseCatalog = baseCatalog; this.baseExecutor = baseExecutor;
    this.listResources = listResources; this.readResource = readResource; this.artifacts = artifacts;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    if (!await this.listResources.isAvailable()) return tools;
    const names = new Set(tools.map((tool) => tool.name));
    return [...tools, ...MCP_RESOURCE_TOOL_DEFINITIONS.filter((tool) => !names.has(tool.name))];
  }

  decorateTools(tools: AgentToolDefinition[]) {
    return tools.map((tool) => tool.name === 'read_file' ? decorateReadFile(tool) : tool);
  }

  interceptsTool(toolName: string, args: Record<string, unknown>) {
    return toolName === 'read_file'
      && typeof args.path === 'string'
      && this.artifacts.canReadTextArtifact(args.path);
  }

  async execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal): Promise<ToolResult> {
    try {
      if (this.interceptsTool(toolName, args)) {
        const offset = integerArgument(args.offset, 'offset', 0, MAX_MCP_ARTIFACT_OFFSET_CHARACTERS, 0);
        const limit = integerArgument(args.limit, 'limit', 1, MAX_MCP_ARTIFACT_READ_CHARACTERS, DEFAULT_MCP_ARTIFACT_READ_CHARACTERS);
        const result = await this.artifacts.readTextArtifact({ path: String(args.path), offset, limit });
        const end = result.offset + result.content.length;
        const continuation = result.nextOffset === undefined ? 'end of artifact' : `continue with offset=${result.nextOffset}`;
        return { ok: true, output: `${result.content}\n\n[MCP artifact characters ${result.offset}-${end} of ${result.totalCharacters}; ${continuation}]` };
      }
      if (toolName === LIST_MCP_RESOURCES_TOOL_NAME) {
        const result = await this.listResources.execute(args, signal);
        return { ok: true, output: result.length ? await this.serialize(result) : EMPTY_RESOURCE_MESSAGE };
      }
      if (toolName === READ_MCP_RESOURCE_TOOL_NAME) {
        return { ok: true, output: await this.serialize(await this.readResource.execute(args, signal)) };
      }
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'MCP resource operation failed.' };
    }
  }

  private async serialize(value: unknown) {
    const content = JSON.stringify(value);
    if (content.length <= MAX_MCP_RESOURCE_RESULT_CHARACTERS) return content;
    const persisted = await this.artifacts.persistToolResult({ content });
    return [
      `Error: result (${content.length.toLocaleString()} characters) exceeds maximum allowed tokens. Output has been saved to ${persisted.path}`,
      'Format: JSON',
      `Use read_file with that exact path and optional offset/limit arguments (maximum ${MAX_MCP_ARTIFACT_READ_CHARACTERS} characters per chunk).`,
    ].join('\n');
  }
}

function decorateReadFile(tool: AgentToolDefinition): AgentToolDefinition {
  const properties = isObject(tool.parameters.properties) ? tool.parameters.properties : {};
  return {
    ...tool,
    description: tool.description.includes(ARTIFACT_READ_DESCRIPTION)
      ? tool.description : `${tool.description} ${ARTIFACT_READ_DESCRIPTION}`,
    parameters: {
      ...tool.parameters,
      properties: {
        ...properties,
        offset: { type: 'integer', minimum: 0, maximum: MAX_MCP_ARTIFACT_OFFSET_CHARACTERS, description: 'Character offset for a private MCP text artifact only.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_MCP_ARTIFACT_READ_CHARACTERS, description: 'Maximum characters for a private MCP text artifact only.' },
      },
    },
  };
}

function integerArgument(value: unknown, name: string, minimum: number, maximum: number, fallback: number) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return Number(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
