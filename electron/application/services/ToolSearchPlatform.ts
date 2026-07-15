import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import {
  TOOL_SEARCH_TOOL_DEFINITION,
  TOOL_SEARCH_TOOL_NAME,
  isDeferredTool,
} from '../../domain/entities/toolSearch.js';
import type { IAgentWorkspaceScope } from '../../domain/ports/IAgentWorkspaceScope.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import { parseToolSearchInput } from './toolSearchInput.js';
import { formatToolSearchResult } from './toolSearchOutput.js';
import { searchDeferredTools } from './toolSearchRanking.js';

const MAX_ANNOUNCEMENT_CHARACTERS = 12_000;

export class ToolSearchPlatform implements IToolCatalog, IToolExecutor, IAgentWorkspaceScope {
  private readonly loaded = new Set<string>();
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly workspaceScope: IAgentWorkspaceScope;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    workspaceScope: IAgentWorkspaceScope,
    initiallyLoaded: Iterable<string> = [],
  ) {
    this.baseCatalog = baseCatalog; this.baseExecutor = baseExecutor; this.workspaceScope = workspaceScope;
    for (const name of initiallyLoaded) this.loaded.add(name);
  }

  currentRoot(fallbackRoot: string) { return this.workspaceScope.currentRoot(fallbackRoot); }

  async list(workspaceRoot: string) {
    const all = uniqueTools(await this.baseCatalog.list(this.currentRoot(workspaceRoot)));
    const deferred = all.filter(isDeferredTool);
    const visible = all.filter((tool) => !isDeferredTool(tool) || this.loaded.has(tool.name));
    return [
      ...visible.filter((tool) => tool.name !== TOOL_SEARCH_TOOL_NAME),
      toolSearchDefinition(deferred.filter((tool) => !this.loaded.has(tool.name))),
    ];
  }

  async execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal): Promise<ToolResult> {
    if (signal?.aborted) return { ok: false, output: 'Agent session stopped.' };
    try {
      const root = this.currentRoot(workspaceRoot);
      const all = uniqueTools(await this.baseCatalog.list(root));
      if (toolName !== TOOL_SEARCH_TOOL_NAME) {
        const requested = all.find((tool) => tool.name === toolName);
        if (requested && isDeferredTool(requested) && !this.loaded.has(toolName)) {
          return { ok: false, output: `${toolName} is deferred. Load it with ToolSearch before calling it.` };
        }
        return this.baseExecutor.execute(toolName, args, root, permissionMode, signal);
      }
      const input = parseToolSearchInput(args);
      const deferred = all.filter(isDeferredTool);
      const names = searchDeferredTools(input.query, deferred, all, input.maxResults);
      const definitions = names.flatMap((name) => {
        const tool = all.find((candidate) => candidate.name === name);
        return tool ? [tool] : [];
      });
      const formatted = formatToolSearchResult(input.query, deferred.length, definitions);
      for (const tool of formatted.included) if (isDeferredTool(tool)) this.loaded.add(tool.name);
      return { ok: true, output: formatted.output };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'ToolSearch failed.' };
    }
  }
}

function uniqueTools(tools: readonly AgentToolDefinition[]) {
  const byName = new Map<string, AgentToolDefinition>();
  for (const tool of tools) if (!byName.has(tool.name)) byName.set(tool.name, tool);
  return [...byName.values()];
}

function toolSearchDefinition(unloaded: readonly AgentToolDefinition[]) {
  const names = unloaded.map((tool) => tool.name).join('\n').slice(0, MAX_ANNOUNCEMENT_CHARACTERS);
  return {
    ...structuredClone(TOOL_SEARCH_TOOL_DEFINITION),
    description: [
      TOOL_SEARCH_TOOL_DEFINITION.description,
      'Until selected, these tools have no callable parameter schema. Use select:Name,OtherName or capability keywords.',
      '<available-deferred-tools>', names || '(all deferred schemas are already loaded)', '</available-deferred-tools>',
    ].join('\n'),
  } satisfies AgentToolDefinition;
}
