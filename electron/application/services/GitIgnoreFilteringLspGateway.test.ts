import { describe, expect, it, vi } from 'vitest';
import type { LspGatewayResult, LspToolInput } from '../../domain/entities/lsp.js';
import type { ILanguageServerGateway } from '../../domain/ports/ILanguageServerGateway.js';
import { GitIgnoreFilteringLspGateway } from './GitIgnoreFilteringLspGateway.js';

describe('GitIgnoreFilteringLspGateway', () => {
  it('filters ignored definition locations using one unique path query', async () => {
    const result: LspGatewayResult = {
      kind: 'locations',
      locations: [location('src/main.ts'), location('generated/types.ts'), location('generated/types.ts')],
    };
    const base = gateway(result);
    const findIgnoredPaths = vi.fn(async () => new Set(['generated/types.ts']));
    const filtering = new GitIgnoreFilteringLspGateway(base, { findIgnoredPaths });

    const filtered = await filtering.execute(input('goToDefinition'), '/workspace');
    expect(filtered).toMatchObject({ kind: 'locations', locations: [{ filePath: 'src/main.ts' }] });
    expect(findIgnoredPaths).toHaveBeenCalledWith(['src/main.ts', 'generated/types.ts'], '/workspace', undefined);
  });

  it('filters workspace symbols but leaves non-location operations unchanged', async () => {
    const symbols: LspGatewayResult = {
      kind: 'workspaceSymbols',
      symbols: [
        { name: 'kept', kind: 12, location: location('src/main.ts') },
        { name: 'ignored', kind: 12, location: location('dist/main.ts') },
      ],
    };
    const findIgnoredPaths = vi.fn(async () => new Set(['dist/main.ts']));
    const filtering = new GitIgnoreFilteringLspGateway(gateway(symbols), { findIgnoredPaths });
    expect(await filtering.execute(input('workspaceSymbol'), '/workspace')).toMatchObject({
      kind: 'workspaceSymbols', symbols: [{ name: 'kept' }],
    });

    const hover: LspGatewayResult = { kind: 'hover', hover: { content: 'value' } };
    const passive = new GitIgnoreFilteringLspGateway(gateway(hover), { findIgnoredPaths });
    await expect(passive.execute(input('hover'), '/workspace')).resolves.toBe(hover);
    expect(findIgnoredPaths).toHaveBeenCalledTimes(1);
  });
});

function gateway(result: LspGatewayResult): ILanguageServerGateway {
  return { isAvailable: async () => true, execute: async () => result };
}

function location(filePath: string) {
  return {
    filePath,
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
  };
}

function input(operation: LspToolInput['operation']): LspToolInput {
  return { operation, filePath: 'src/main.ts', line: 1, character: 1 };
}
