import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';

export type ToolCatalogSnapshot = {
  definitions: AgentToolDefinition[];
  byName: Map<string, AgentToolDefinition>;
};

export async function loadToolCatalogSnapshot(
  catalog: IToolCatalog,
  workspaceRoot: string,
): Promise<ToolCatalogSnapshot> {
  const definitions = await catalog.list(workspaceRoot);
  return {
    definitions,
    byName: new Map(definitions.map((tool) => [tool.name, tool])),
  };
}
