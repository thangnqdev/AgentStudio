import { LSP_OPERATIONS, type LspOperation, type LspToolInput } from '../../domain/entities/lsp.js';

const ALLOWED_FIELDS = new Set(['operation', 'filePath', 'line', 'character']);
const OPERATIONS = new Set<string>(LSP_OPERATIONS);

export function parseLspInput(args: Record<string, unknown>): LspToolInput {
  const unknownField = Object.keys(args).find((field) => !ALLOWED_FIELDS.has(field));
  if (unknownField) throw new Error(`Invalid LSP input: unknown property "${unknownField}".`);

  const operation = typeof args.operation === 'string' ? args.operation : '';
  if (!OPERATIONS.has(operation)) throw new Error('Invalid LSP input: operation is not supported.');

  const filePath = typeof args.filePath === 'string' ? args.filePath.trim() : '';
  if (!filePath) throw new Error('Invalid LSP input: filePath is required.');

  const line = positiveInteger(args.line, 'line');
  const character = positiveInteger(args.character, 'character');
  return { operation: operation as LspOperation, filePath, line, character };
}

function positiveInteger(value: unknown, field: string) {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`Invalid LSP input: ${field} must be a positive integer.`);
  }
  return value as number;
}
