export const MAX_IDE_SELECTION_TEXT_CHARS = 20_000;
export const MAX_IDE_SELECTION_CONTEXT_CHARS = 2_000;
export const MAX_IDE_AT_MENTIONS = 10;
export const MAX_IDE_AT_MENTION_CONTEXT_CHARS = 12_000;
export const MAX_IDE_AMBIENT_CONTEXT_CHARS = 24_000;

export type IdeSelection = {
  filePath: string;
  text?: string;
  lineStart?: number;
  lineEnd?: number;
};

export type IdeAtMention = {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
};

export function parseIdeSelectionChangedNotification(value: unknown): IdeSelection | null {
  if (!isObject(value) || value.method !== 'selection_changed' || !isObject(value.params)) return null;
  const filePath = boundedText(value.params.filePath, 4_096);
  const text = value.params.text === undefined
    ? undefined
    : boundedText(value.params.text, MAX_IDE_SELECTION_TEXT_CHARS, true);
  if (!filePath || text === null) return null;

  const range = parseRange(value.params.selection);
  if (text && !range) return null;
  if (!text) return { filePath };
  const lineStart = range!.start.line + 1;
  const lineEnd = Math.max(lineStart, range!.end.line + (range!.end.character === 0 ? 0 : 1));
  return { filePath, text, lineStart, lineEnd };
}

export function parseIdeAtMentionedNotification(value: unknown): IdeAtMention | null {
  if (!isObject(value) || value.method !== 'at_mentioned' || !isObject(value.params)) return null;
  const filePath = boundedText(value.params.filePath, 4_096);
  if (!filePath) return null;
  const start = optionalLine(value.params.lineStart);
  const end = optionalLine(value.params.lineEnd);
  if (start === null || end === null || (start === undefined && end !== undefined)) return null;
  const lineStart = start === undefined ? undefined : start + 1;
  const lineEnd = end === undefined ? lineStart : end + 1;
  if (lineStart !== undefined && lineEnd !== undefined && lineEnd < lineStart) return null;
  return { filePath, ...(lineStart !== undefined ? { lineStart, lineEnd } : {}) };
}

function parseRange(value: unknown) {
  if (!isObject(value) || !isPoint(value.start) || !isPoint(value.end)) return null;
  const startsAfterEnd = value.start.line > value.end.line
    || (value.start.line === value.end.line && value.start.character > value.end.character);
  return startsAfterEnd ? null : { start: value.start, end: value.end };
}

function isPoint(value: unknown): value is { line: number; character: number } {
  return isObject(value)
    && boundedInteger(value.line, 0, 10_000_000)
    && boundedInteger(value.character, 0, 10_000_000);
}

function boundedText(value: unknown, maximum: number, allowEmpty = false) {
  return typeof value === 'string' && (allowEmpty || value.length > 0)
    && value.length <= maximum && !value.includes('\0') ? value : null;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function optionalLine(value: unknown) {
  return value === undefined ? undefined : boundedInteger(value, 0, 10_000_000) ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
