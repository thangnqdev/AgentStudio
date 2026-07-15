import type { AgentInteractionAnnotation, AgentInteractionResponse } from '../../domain/entities/agentInteraction.js';

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/;

export type ParsedAgentInteractionResponse = {
  requestId: string;
  interactionId: string;
  response: AgentInteractionResponse;
};

export function parseAgentInteractionResponse(value: unknown): ParsedAgentInteractionResponse | null {
  if (!isObject(value) || hasExtraKeys(value, ['requestId', 'interactionId', 'response'])) return null;
  const requestId = readId(value.requestId);
  const interactionId = readId(value.interactionId);
  if (!requestId || !interactionId || !isObject(value.response)) return null;
  if (hasExtraKeys(value.response, ['accepted', 'answers', 'annotations']) || typeof value.response.accepted !== 'boolean') return null;
  const answers = parseStringRecord(value.response.answers, 4, 2_000, 2_000);
  const annotations = parseAnnotations(value.response.annotations);
  if (answers === null || annotations === null) return null;
  return {
    requestId,
    interactionId,
    response: {
      accepted: value.response.accepted,
      ...(answers ? { answers } : {}),
      ...(annotations ? { annotations } : {}),
    },
  };
}

function parseAnnotations(value: unknown): Record<string, AgentInteractionAnnotation> | undefined | null {
  if (value === undefined) return undefined;
  if (!isObject(value) || Object.keys(value).length > 4) return null;
  const result: Record<string, AgentInteractionAnnotation> = {};
  for (const [question, annotation] of Object.entries(value)) {
    if (!validString(question, 2_000) || !isObject(annotation) || hasExtraKeys(annotation, ['preview', 'notes'])) return null;
    const preview = optionalString(annotation.preview, 8_000);
    const notes = optionalString(annotation.notes, 2_000);
    if (preview === null || notes === null) return null;
    result[question] = { ...(preview ? { preview } : {}), ...(notes ? { notes } : {}) };
  }
  return result;
}

function parseStringRecord(value: unknown, maxEntries: number, maxKey: number, maxValue: number) {
  if (value === undefined) return undefined;
  if (!isObject(value) || Object.keys(value).length > maxEntries) return null;
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!validString(key, maxKey) || !validString(item, maxValue)) return null;
    result[key] = item;
  }
  return result;
}

function readId(value: unknown) {
  return typeof value === 'string' && SAFE_ID.test(value) ? value : '';
}

function optionalString(value: unknown, maximum: number): string | undefined | null {
  if (value === undefined) return undefined;
  return validString(value, maximum) ? value : null;
}

function validString(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && !value.includes('\0') && value.length > 0 && value.length <= maximum;
}

function hasExtraKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).some((key) => !allowed.includes(key));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
