import type { LspCallHierarchyItem, LspIncomingCall, LspOutgoingCall } from '../../domain/entities/lsp.js';
import { formatCallItem, formatRanges, symbolKindName } from './lspFormattingShared.js';

export function formatCallHierarchy(items: LspCallHierarchyItem[]) {
  if (!items.length) return result('No call hierarchy item found at this position', 0, 0);
  const files = new Set(items.map((item) => item.filePath)).size;
  if (items.length === 1) return result(`Call hierarchy item: ${formatCallItem(items[0]!)}`, 1, files);
  return result(`Found ${items.length} call hierarchy items:\n${items.map((item) => `  ${formatCallItem(item)}`).join('\n')}`, items.length, files);
}

export function formatIncomingCalls(calls: LspIncomingCall[]) {
  if (!calls.length) return result('No incoming calls found (nothing calls this function)', 0, 0);
  return formatCalls('incoming', calls.map((call) => ({ item: call.from, ranges: call.fromRanges })), 'calls at');
}

export function formatOutgoingCalls(calls: LspOutgoingCall[]) {
  if (!calls.length) return result('No outgoing calls found (this function calls nothing)', 0, 0);
  return formatCalls('outgoing', calls.map((call) => ({ item: call.to, ranges: call.fromRanges })), 'called from');
}

function formatCalls(direction: 'incoming' | 'outgoing', calls: Array<{ item: LspCallHierarchyItem; ranges: LspIncomingCall['fromRanges'] }>, rangeLabel: string) {
  const grouped = new Map<string, typeof calls>();
  for (const call of calls) grouped.set(call.item.filePath, [...(grouped.get(call.item.filePath) || []), call]);
  const lines = [`Found ${calls.length} ${direction} ${calls.length === 1 ? 'call' : 'calls'}:`];
  for (const [filePath, entries] of grouped) {
    lines.push(`\n${filePath}:`);
    for (const { item, ranges } of entries) {
      const sites = ranges.length ? ` [${rangeLabel}: ${formatRanges(ranges)}]` : '';
      lines.push(`  ${item.name} (${symbolKindName(item.kind)}) - Line ${item.range.start.line + 1}${sites}`);
    }
  }
  return result(lines.join('\n'), calls.length, grouped.size);
}

function result(formatted: string, resultCount: number, fileCount: number) {
  return { formatted, resultCount, fileCount };
}
