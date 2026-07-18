import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  LspCallHierarchyItem,
  LspDocumentSymbol,
  LspGatewayResult,
  LspLocation,
  LspRange,
  LspWorkspaceSymbol,
} from '../../domain/entities/lsp.js';

export function normalizeLspResponse(operation: string, raw: unknown, workspaceRoot: string): LspGatewayResult {
  if (operation === 'hover') return { kind: 'hover', hover: normalizeHover(raw) };
  if (operation === 'documentSymbol') {
    const values = array(raw);
    if (values.some((value) => isObject(value) && isObject(value.location))) {
      return { kind: 'workspaceSymbols', symbols: values.flatMap((value) => normalizeWorkspaceSymbol(value, workspaceRoot)) };
    }
    return { kind: 'documentSymbols', symbols: values.flatMap(normalizeDocumentSymbol) };
  }
  if (operation === 'workspaceSymbol') return { kind: 'workspaceSymbols', symbols: array(raw).flatMap((value) => normalizeWorkspaceSymbol(value, workspaceRoot)) };
  if (operation === 'prepareCallHierarchy') return { kind: 'callHierarchy', items: array(raw).flatMap((value) => normalizeCallItem(value, workspaceRoot)) };
  if (operation === 'incomingCalls') {
    return {
      kind: 'incomingCalls',
      calls: array(raw).flatMap((value) => {
        if (!isObject(value)) return [];
        const from = normalizeCallItem(value.from, workspaceRoot)[0];
        return from ? [{ from, fromRanges: array(value.fromRanges).flatMap(normalizeRange) }] : [];
      }),
    };
  }
  if (operation === 'outgoingCalls') {
    return {
      kind: 'outgoingCalls',
      calls: array(raw).flatMap((value) => {
        if (!isObject(value)) return [];
        const to = normalizeCallItem(value.to, workspaceRoot)[0];
        return to ? [{ to, fromRanges: array(value.fromRanges).flatMap(normalizeRange) }] : [];
      }),
    };
  }
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return { kind: 'locations', locations: values.flatMap((value) => normalizeLocation(value, workspaceRoot)) };
}

function normalizeHover(raw: unknown) {
  if (!isObject(raw)) return null;
  const content = markupText(raw.contents);
  const range = normalizeRange(raw.range)[0];
  return { content, ...(range ? { range } : {}) };
}

function normalizeDocumentSymbol(raw: unknown): LspDocumentSymbol[] {
  if (!isObject(raw) || typeof raw.name !== 'string' || typeof raw.kind !== 'number') return [];
  const range = normalizeRange(raw.range)[0] || (isObject(raw.location) ? normalizeRange(raw.location.range)[0] : undefined);
  if (!range) return [];
  const children = array(raw.children).flatMap(normalizeDocumentSymbol);
  return [{
    name: raw.name,
    kind: raw.kind,
    range,
    ...(typeof raw.detail === 'string' ? { detail: raw.detail } : {}),
    ...(children.length ? { children } : {}),
  }];
}

function normalizeWorkspaceSymbol(raw: unknown, workspaceRoot: string): LspWorkspaceSymbol[] {
  if (!isObject(raw) || typeof raw.name !== 'string' || typeof raw.kind !== 'number') return [];
  const location = normalizeLocation(raw.location, workspaceRoot)[0];
  if (!location) return [];
  return [{
    name: raw.name,
    kind: raw.kind,
    location,
    ...(typeof raw.containerName === 'string' ? { containerName: raw.containerName } : {}),
  }];
}

function normalizeLocation(raw: unknown, workspaceRoot: string): LspLocation[] {
  if (!isObject(raw)) return [];
  const uri = typeof raw.uri === 'string' ? raw.uri : typeof raw.targetUri === 'string' ? raw.targetUri : '';
  const range = normalizeRange(raw.range)[0]
    || normalizeRange(raw.targetSelectionRange)[0]
    || normalizeRange(raw.targetRange)[0];
  return uri && range ? [{ filePath: displayPath(uri, workspaceRoot), range }] : [];
}

function normalizeCallItem(raw: unknown, workspaceRoot: string): LspCallHierarchyItem[] {
  if (!isObject(raw) || typeof raw.name !== 'string' || typeof raw.kind !== 'number' || typeof raw.uri !== 'string') return [];
  const range = normalizeRange(raw.range)[0];
  if (!range) return [];
  return [{
    name: raw.name,
    kind: raw.kind,
    filePath: displayPath(raw.uri, workspaceRoot),
    range,
    ...(typeof raw.detail === 'string' ? { detail: raw.detail } : {}),
  }];
}

function normalizeRange(raw: unknown): LspRange[] {
  if (!isObject(raw)) return [];
  const start = normalizePosition(raw.start);
  const end = normalizePosition(raw.end);
  return start && end ? [{ start, end }] : [];
}

function normalizePosition(raw: unknown) {
  if (!isObject(raw) || !Number.isInteger(raw.line) || !Number.isInteger(raw.character)) return undefined;
  return { line: raw.line as number, character: raw.character as number };
}

function markupText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(markupText).join('\n\n');
  if (isObject(raw) && typeof raw.value === 'string') return raw.value;
  return '';
}

function displayPath(uri: string, workspaceRoot: string) {
  let filePath = uri;
  try { if (uri.startsWith('file:')) filePath = fileURLToPath(uri); } catch { filePath = uri.replace(/^file:\/\//, ''); }
  const relative = path.relative(workspaceRoot, filePath).replaceAll('\\', '/');
  if (relative && !relative.startsWith('../') && relative.length < filePath.length) return relative;
  return filePath.replaceAll('\\', '/');
}

function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
