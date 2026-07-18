import type { AgentToolDefinition, JsonSchema } from '../../domain/entities/tool.js';

export type ToolArgumentParseResult = { ok: true; args: Record<string, unknown> } | { ok: false; args: Record<string, unknown>; error: string };

const MAX_STRUCTURED_COMPATIBILITY_CHARS = 100_000;

export function parseAndValidateToolArguments(raw: string, tool: AgentToolDefinition): ToolArgumentParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, args: {}, error: 'Invalid arguments: expected a JSON object.' };
  }
  if (!isObject(parsed)) return { ok: false, args: {}, error: 'Invalid arguments: expected a JSON object.' };

  const properties = isObject(tool.parameters.properties) ? tool.parameters.properties : {};
  if (tool.parameters.additionalProperties === false) {
    const unknown = Object.keys(parsed).find((field) => !Object.hasOwn(properties, field));
    if (unknown) return { ok: false, args: parsed, error: `Invalid arguments: unknown property "${unknown}".` };
  }
  const normalized = normalizeStructuredProperties(parsed, properties);
  const required = Array.isArray(tool.parameters.required)
    ? tool.parameters.required.filter((field): field is string => typeof field === 'string')
    : [];
  for (const field of required) {
    if (!Object.hasOwn(normalized, field)) return { ok: false, args: normalized, error: `Invalid arguments: required property "${field}" is missing.` };
  }
  for (const [field, schema] of Object.entries(properties)) {
    if (!Object.hasOwn(normalized, field) || !isObject(schema)) continue;
    const error = validateValue(field, normalized[field], schema);
    if (error) return { ok: false, args: normalized, error };
  }
  return { ok: true, args: normalized };
}

function normalizeStructuredProperties(value: Record<string, unknown>, properties: Record<string, unknown>) {
  const normalized = { ...value };
  for (const [field, rawSchema] of Object.entries(properties)) {
    if (!Object.hasOwn(value, field) || !isObject(rawSchema)) continue;
    normalized[field] = parseStringifiedStructure(value[field], rawSchema.type);
  }
  return normalized;
}

function parseStringifiedStructure(value: unknown, expectedType: unknown) {
  if (typeof value !== 'string' || value.length > MAX_STRUCTURED_COMPATIBILITY_CHARS) return value;
  if (expectedType !== 'array' && expectedType !== 'object') return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return matchesType(parsed, expectedType) ? parsed : value;
  } catch {
    return value;
  }
}

function validateValue(field: string, value: unknown, schema: JsonSchema) {
  const type = schema.type;
  if (typeof type === 'string' && !matchesType(value, type)) return `Invalid arguments: property "${field}" must be ${type}.`;
  if (Array.isArray(schema.enum) && !schema.enum.some((option) => Object.is(option, value))) return `Invalid arguments: property "${field}" must be an allowed value.`;
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) return `Invalid arguments: property "${field}" is below its minimum.`;
    if (typeof schema.maximum === 'number' && value > schema.maximum) return `Invalid arguments: property "${field}" exceeds its maximum.`;
  }
  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) return `Invalid arguments: property "${field}" is too short.`;
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) return `Invalid arguments: property "${field}" is too long.`;
    if (typeof schema.pattern === 'string' && !matchesPattern(value, schema.pattern)) return `Invalid arguments: property "${field}" has an invalid format.`;
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) return `Invalid arguments: property "${field}" has too few items.`;
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) return `Invalid arguments: property "${field}" has too many items.`;
  }
  return '';
}

function matchesPattern(value: string, pattern: string) {
  try { return new RegExp(pattern).test(value); } catch { return false; }
}

function matchesType(value: unknown, type: string) {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isObject(value);
  if (type === 'null') return value === null;
  return true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
