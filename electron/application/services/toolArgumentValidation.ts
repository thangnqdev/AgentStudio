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
  return '';
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
