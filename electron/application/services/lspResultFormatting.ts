import type { LspGatewayResult, LspToolInput, LspToolOutput } from '../../domain/entities/lsp.js';
import { formatCallHierarchy, formatIncomingCalls, formatOutgoingCalls } from './lspCallFormatting.js';
import { formatLocationResult } from './lspLocationFormatting.js';
import { formatDocumentSymbols, formatWorkspaceSymbols } from './lspSymbolFormatting.js';

export function formatLspResult(input: LspToolInput, result: LspGatewayResult): LspToolOutput {
  const summary = formatSummary(input, result);
  return {
    operation: input.operation,
    result: summary.formatted,
    filePath: input.filePath,
    resultCount: summary.resultCount,
    fileCount: summary.fileCount,
  };
}

function formatSummary(input: LspToolInput, result: LspGatewayResult) {
  if (result.kind === 'locations') return formatLocationResult(input.operation, result.locations);
  if (result.kind === 'hover') {
    if (!result.hover) return summary('No hover information available. This may occur if the cursor is not on a symbol, or if the LSP server has not fully indexed the file.', 0, 0);
    const position = result.hover.range
      ? `Hover info at ${result.hover.range.start.line + 1}:${result.hover.range.start.character + 1}:\n\n`
      : '';
    return summary(`${position}${result.hover.content}`, 1, 1);
  }
  if (result.kind === 'documentSymbols') return formatDocumentSymbols(result.symbols);
  if (result.kind === 'workspaceSymbols') return formatWorkspaceSymbols(result.symbols);
  if (result.kind === 'callHierarchy') return formatCallHierarchy(result.items);
  if (result.kind === 'incomingCalls') return formatIncomingCalls(result.calls);
  return formatOutgoingCalls(result.calls);
}

function summary(formatted: string, resultCount: number, fileCount: number) {
  return { formatted, resultCount, fileCount };
}
