import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type {
  LspDiagnostic,
  LspDiagnosticFile,
  LspDiagnosticSeverity,
} from '../../domain/entities/lspDiagnostic.js';

export function normalizePublishedDiagnostics(raw: unknown, workspaceRoot: string): LspDiagnosticFile[] {
  if (!isObject(raw) || typeof raw.uri !== 'string' || !Array.isArray(raw.diagnostics)) return [];
  const location = normalizeUri(raw.uri, workspaceRoot);
  const diagnostics = raw.diagnostics.flatMap(normalizeDiagnostic);
  return diagnostics.length > 0 ? [{ ...location, diagnostics }] : [];
}

export function mapLspDiagnosticSeverity(value: unknown): LspDiagnosticSeverity {
  if (value === 2) return 'Warning';
  if (value === 3) return 'Info';
  if (value === 4) return 'Hint';
  return 'Error';
}

function normalizeDiagnostic(raw: unknown): LspDiagnostic[] {
  if (!isObject(raw) || typeof raw.message !== 'string') return [];
  const range = normalizeRange(raw.range);
  if (!range) return [];
  const source = typeof raw.source === 'string' ? raw.source : undefined;
  const code = typeof raw.code === 'string' || typeof raw.code === 'number' ? String(raw.code) : undefined;
  return [{
    message: raw.message,
    severity: mapLspDiagnosticSeverity(raw.severity),
    range,
    ...(source ? { source } : {}),
    ...(code !== undefined ? { code } : {}),
  }];
}

function normalizeRange(raw: unknown) {
  if (!isObject(raw)) return undefined;
  const start = normalizePosition(raw.start);
  const end = normalizePosition(raw.end);
  return start && end ? { start, end } : undefined;
}

function normalizePosition(raw: unknown) {
  if (!isObject(raw) || !nonNegativeInteger(raw.line) || !nonNegativeInteger(raw.character)) return undefined;
  return { line: raw.line as number, character: raw.character as number };
}

function normalizeUri(uri: string, workspaceRoot: string) {
  try {
    const filePath = uri.startsWith('file:') ? fileURLToPath(uri) : uri;
    if (path.isAbsolute(filePath)) return fileLocation(filePath, workspaceRoot);
    if (!hasUriScheme(uri)) return fileLocation(path.resolve(workspaceRoot, filePath), workspaceRoot);
  } catch {
    return { uri, filePath: uri };
  }
  return { uri, filePath: uri };
}

function fileLocation(filePath: string, workspaceRoot: string) {
  const absolutePath = realPathOrResolved(filePath);
  const relative = path.relative(realPathOrResolved(workspaceRoot), absolutePath);
  const inside = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  return {
    uri: pathToFileURL(absolutePath).href,
    filePath: (inside ? relative : absolutePath).replaceAll('\\', '/'),
  };
}

function realPathOrResolved(value: string) {
  try { return realpathSync.native(value); } catch { return path.resolve(value); }
}

function hasUriScheme(value: string) { return /^[a-z][a-z0-9+.-]*:/i.test(value); }
function nonNegativeInteger(value: unknown) { return Number.isInteger(value) && Number(value) >= 0; }
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
