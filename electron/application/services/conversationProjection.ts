import type { ChatMessage } from '../../domain/entities/agent.js';

export type ConversationProjectionPolicy = {
  maximumToolResultCharacters: number;
  totalToolResultBudgetCharacters: number;
  protectedRecentToolResults: number;
};

export type ConversationProjection = {
  messages: ChatMessage[];
  truncatedToolResults: number;
  omittedToolResults: number;
  originalToolResultCharacters: number;
  projectedToolResultCharacters: number;
};

const DEFAULT_POLICY: ConversationProjectionPolicy = {
  maximumToolResultCharacters: 12_000,
  totalToolResultBudgetCharacters: 24_000,
  protectedRecentToolResults: 4,
};

export function projectConversationForModel(
  messages: ChatMessage[],
  policy: Partial<ConversationProjectionPolicy> = {},
): ConversationProjection {
  const normalized = normalizePolicy(policy);
  const projected = messages.map((message) => ({ ...message }));
  const toolIndexes: number[] = [];
  let originalCharacters = 0;
  let projectedCharacters = 0;
  let truncatedToolResults = 0;

  for (let index = 0; index < projected.length; index += 1) {
    const message = projected[index];
    if (message.role !== 'tool' || typeof message.content !== 'string') continue;
    toolIndexes.push(index);
    let content = message.content;
    originalCharacters += content.length;
    if (content.length > normalized.maximumToolResultCharacters) {
      content = `${content.slice(0, normalized.maximumToolResultCharacters)}\n[tool result truncated by AgentStudio]`;
      message.content = content;
      truncatedToolResults += 1;
    }
    projectedCharacters += content.length;
  }

  let omittedToolResults = 0;
  const protectedIndexes = new Set(toolIndexes.slice(-normalized.protectedRecentToolResults));
  for (const index of toolIndexes) {
    if (projectedCharacters <= normalized.totalToolResultBudgetCharacters) break;
    if (protectedIndexes.has(index)) continue;
    const message = projected[index];
    if (typeof message.content !== 'string') continue;
    const replacement = `[Older tool result omitted by AgentStudio; tool_call_id=${message.tool_call_id || 'unknown'}]`;
    projectedCharacters += replacement.length - message.content.length;
    message.content = replacement;
    omittedToolResults += 1;
  }

  return {
    messages: projected,
    truncatedToolResults,
    omittedToolResults,
    originalToolResultCharacters: originalCharacters,
    projectedToolResultCharacters: projectedCharacters,
  };
}

export function contextProjectionPolicy(inputContextTokens: number): ConversationProjectionPolicy {
  const estimatedCharacters = Math.max(4_000, Math.floor(inputContextTokens * 4));
  return {
    maximumToolResultCharacters: Math.min(16_000, Math.max(4_000, Math.floor(estimatedCharacters * 0.12))),
    totalToolResultBudgetCharacters: Math.min(48_000, Math.max(8_000, Math.floor(estimatedCharacters * 0.22))),
    protectedRecentToolResults: 4,
  };
}

function normalizePolicy(policy: Partial<ConversationProjectionPolicy>): ConversationProjectionPolicy {
  return {
    maximumToolResultCharacters: positiveInteger(policy.maximumToolResultCharacters, DEFAULT_POLICY.maximumToolResultCharacters),
    totalToolResultBudgetCharacters: positiveInteger(policy.totalToolResultBudgetCharacters, DEFAULT_POLICY.totalToolResultBudgetCharacters),
    protectedRecentToolResults: nonNegativeInteger(policy.protectedRecentToolResults, DEFAULT_POLICY.protectedRecentToolResults),
  };
}

function positiveInteger(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && value! > 0 ? value! : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && value! >= 0 ? value! : fallback;
}
