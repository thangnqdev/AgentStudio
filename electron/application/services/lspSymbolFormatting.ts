import type { LspDocumentSymbol, LspWorkspaceSymbol } from '../../domain/entities/lsp.js';
import { symbolKindName } from './lspFormattingShared.js';

export function formatDocumentSymbols(symbols: LspDocumentSymbol[]) {
  if (!symbols.length) {
    return result('No symbols found in document. This may occur if the file is empty, not supported by the LSP server, or if the server has not fully indexed the file.', 0, 0);
  }
  const lines = ['Document symbols:'];
  for (const symbol of symbols) lines.push(...formatNode(symbol, 0));
  return result(lines.join('\n'), countSymbols(symbols), 1);
}

export function formatWorkspaceSymbols(symbols: LspWorkspaceSymbol[]) {
  if (!symbols.length) {
    return result('No symbols found in workspace. This may occur if the workspace is empty, or if the LSP server has not finished indexing the project.', 0, 0);
  }
  const grouped = new Map<string, LspWorkspaceSymbol[]>();
  for (const symbol of symbols) grouped.set(symbol.location.filePath, [...(grouped.get(symbol.location.filePath) || []), symbol]);
  const lines = [`Found ${symbols.length} ${symbols.length === 1 ? 'symbol' : 'symbols'} in workspace:`];
  for (const [filePath, entries] of grouped) {
    lines.push(`\n${filePath}:`);
    for (const symbol of entries) {
      const container = symbol.containerName ? ` in ${symbol.containerName}` : '';
      lines.push(`  ${symbol.name} (${symbolKindName(symbol.kind)}) - Line ${symbol.location.range.start.line + 1}${container}`);
    }
  }
  return result(lines.join('\n'), symbols.length, grouped.size);
}

function formatNode(symbol: LspDocumentSymbol, depth: number): string[] {
  const detail = symbol.detail ? ` ${symbol.detail}` : '';
  const line = `${'  '.repeat(depth)}${symbol.name} (${symbolKindName(symbol.kind)})${detail} - Line ${symbol.range.start.line + 1}`;
  return [line, ...(symbol.children || []).flatMap((child) => formatNode(child, depth + 1))];
}

function countSymbols(symbols: readonly LspDocumentSymbol[]): number {
  return symbols.reduce((count, symbol) => count + 1 + countSymbols(symbol.children || []), 0);
}

function result(formatted: string, resultCount: number, fileCount: number) {
  return { formatted, resultCount, fileCount };
}
