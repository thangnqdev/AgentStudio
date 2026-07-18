import type { LspCallHierarchyItem, LspLocation, LspRange } from '../../domain/entities/lsp.js';

const SYMBOL_KINDS = [
  '', 'File', 'Module', 'Namespace', 'Package', 'Class', 'Method', 'Property', 'Field',
  'Constructor', 'Enum', 'Interface', 'Function', 'Variable', 'Constant', 'String',
  'Number', 'Boolean', 'Array', 'Object', 'Key', 'Null', 'EnumMember', 'Struct',
  'Event', 'Operator', 'TypeParameter',
];

export function symbolKindName(kind: number) {
  return SYMBOL_KINDS[kind] || 'Unknown';
}

export function formatLocation(location: LspLocation) {
  return `${location.filePath}:${location.range.start.line + 1}:${location.range.start.character + 1}`;
}

export function uniqueLocationFiles(locations: readonly LspLocation[]) {
  return new Set(locations.map((location) => location.filePath)).size;
}

export function formatCallItem(item: LspCallHierarchyItem) {
  const detail = item.detail ? ` [${item.detail}]` : '';
  return `${item.name} (${symbolKindName(item.kind)}) - ${item.filePath}:${item.range.start.line + 1}${detail}`;
}

export function formatRanges(ranges: readonly LspRange[]) {
  return ranges.map((range) => `${range.start.line + 1}:${range.start.character + 1}`).join(', ');
}
