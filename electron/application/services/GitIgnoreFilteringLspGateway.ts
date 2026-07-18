import type { LspToolInput } from '../../domain/entities/lsp.js';
import type { ILanguageServerGateway } from '../../domain/ports/ILanguageServerGateway.js';
import type { IWorkspaceIgnoreFilter } from '../../domain/ports/IWorkspaceIgnoreFilter.js';

const LOCATION_OPERATIONS = new Set<LspToolInput['operation']>([
  'goToDefinition',
  'findReferences',
  'goToImplementation',
]);

export class GitIgnoreFilteringLspGateway implements ILanguageServerGateway {
  private readonly base: ILanguageServerGateway;
  private readonly ignoreFilter: IWorkspaceIgnoreFilter;

  constructor(
    base: ILanguageServerGateway,
    ignoreFilter: IWorkspaceIgnoreFilter,
  ) {
    this.base = base;
    this.ignoreFilter = ignoreFilter;
  }

  isAvailable(workspaceRoot: string) {
    return this.base.isAvailable(workspaceRoot);
  }

  async execute(input: LspToolInput, workspaceRoot: string, signal?: AbortSignal) {
    const result = await this.base.execute(input, workspaceRoot, signal);
    if (!result) return result;
    if (LOCATION_OPERATIONS.has(input.operation) && result.kind === 'locations') {
      const ignored = await this.ignored(result.locations.map((item) => item.filePath), workspaceRoot, signal);
      return { ...result, locations: result.locations.filter((item) => !ignored.has(item.filePath)) };
    }
    if (input.operation === 'workspaceSymbol' && result.kind === 'workspaceSymbols') {
      const ignored = await this.ignored(result.symbols.map((item) => item.location.filePath), workspaceRoot, signal);
      return { ...result, symbols: result.symbols.filter((item) => !ignored.has(item.location.filePath)) };
    }
    return result;
  }

  private async ignored(filePaths: string[], workspaceRoot: string, signal?: AbortSignal) {
    const uniquePaths = [...new Set(filePaths)];
    if (uniquePaths.length === 0) return new Set<string>();
    return this.ignoreFilter.findIgnoredPaths(uniquePaths, workspaceRoot, signal);
  }
}
