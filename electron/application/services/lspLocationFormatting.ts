import type { LspLocation, LspOperation } from '../../domain/entities/lsp.js';
import { formatLocation, uniqueLocationFiles } from './lspFormattingShared.js';

export function formatLocationResult(operation: LspOperation, locations: LspLocation[]) {
  if (operation === 'findReferences') return formatReferences(locations);
  return formatDefinitions(operation, locations);
}

function formatDefinitions(_operation: LspOperation, locations: LspLocation[]) {
  if (!locations.length) {
    return summary('No definition found. This may occur if the cursor is not on a symbol, or if the definition is in an external library not indexed by the LSP server.', 0, 0);
  }
  if (locations.length === 1) {
    return summary(`Defined in ${formatLocation(locations[0]!)}`, 1, 1);
  }
  const list = locations.map((location) => `  ${formatLocation(location)}`).join('\n');
  return summary(`Found ${locations.length} definitions:\n${list}`, locations.length, uniqueLocationFiles(locations));
}

function formatReferences(locations: LspLocation[]) {
  if (!locations.length) {
    return summary('No references found. This may occur if the symbol has no usages, or if the LSP server has not fully indexed the workspace.', 0, 0);
  }
  if (locations.length === 1) return summary(`Found 1 reference:\n  ${formatLocation(locations[0]!)}`, 1, 1);

  const grouped = new Map<string, LspLocation[]>();
  for (const location of locations) grouped.set(location.filePath, [...(grouped.get(location.filePath) || []), location]);
  const lines = [`Found ${locations.length} references across ${grouped.size} files:`];
  for (const [filePath, entries] of grouped) {
    lines.push(`\n${filePath}:`);
    for (const entry of entries) lines.push(`  Line ${entry.range.start.line + 1}:${entry.range.start.character + 1}`);
  }
  return summary(lines.join('\n'), locations.length, grouped.size);
}

function summary(formatted: string, resultCount: number, fileCount: number) {
  return { formatted, resultCount, fileCount };
}
