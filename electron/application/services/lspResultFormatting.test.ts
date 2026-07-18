import { describe, expect, it } from 'vitest';
import type { LspRange, LspToolInput } from '../../domain/entities/lsp.js';
import { formatLspResult } from './lspResultFormatting.js';

const range = (line: number, character = 0): LspRange => ({
  start: { line, character }, end: { line, character: character + 1 },
});
const input = (operation: LspToolInput['operation']): LspToolInput => ({
  operation, filePath: 'src/main.ts', line: 1, character: 1,
});

describe('formatLspResult', () => {
  it('formats and counts definitions and grouped references with 1-based positions', () => {
    const definition = formatLspResult(input('goToDefinition'), {
      kind: 'locations', locations: [{ filePath: 'src/target.ts', range: range(4, 2) }],
    });
    expect(definition).toMatchObject({ result: 'Defined in src/target.ts:5:3', resultCount: 1, fileCount: 1 });
    expect(formatLspResult(input('goToImplementation'), {
      kind: 'locations', locations: [{ filePath: 'src/target.ts', range: range(4, 2) }],
    }).result).toBe('Defined in src/target.ts:5:3');

    const references = formatLspResult(input('findReferences'), {
      kind: 'locations',
      locations: [
        { filePath: 'src/a.ts', range: range(1, 3) },
        { filePath: 'src/a.ts', range: range(8, 0) },
        { filePath: 'src/b.ts', range: range(2, 1) },
      ],
    });
    expect(references.result).toContain('Found 3 references across 2 files:');
    expect(references.result).toContain('Line 2:4');
    expect(references).toMatchObject({ resultCount: 3, fileCount: 2 });
  });

  it('counts nested document symbols and formats call sites', () => {
    const symbols = formatLspResult(input('documentSymbol'), {
      kind: 'documentSymbols',
      symbols: [{ name: 'App', kind: 5, range: range(0), children: [{ name: 'run', kind: 6, range: range(4) }] }],
    });
    expect(symbols.result).toBe('Document symbols:\nApp (Class) - Line 1\n  run (Method) - Line 5');
    expect(symbols).toMatchObject({ resultCount: 2, fileCount: 1 });

    const calls = formatLspResult(input('incomingCalls'), {
      kind: 'incomingCalls',
      calls: [{ from: { name: 'caller', kind: 12, filePath: 'src/caller.ts', range: range(6) }, fromRanges: [range(9, 4)] }],
    });
    expect(calls.result).toContain('caller (Function) - Line 7 [calls at: 10:5]');
  });

  it('preserves hover content and reports empty results deterministically', () => {
    const hover = formatLspResult(input('hover'), { kind: 'hover', hover: { content: '`const value: string`', range: range(2, 5) } });
    expect(hover.result).toBe('Hover info at 3:6:\n\n`const value: string`');
    expect(formatLspResult(input('outgoingCalls'), { kind: 'outgoingCalls', calls: [] }).result)
      .toBe('No outgoing calls found (this function calls nothing)');
  });
});
