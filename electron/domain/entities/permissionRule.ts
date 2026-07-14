import type { PermissionMode } from './agent.js';
import { evaluateToolPolicy, type AgentToolDefinition, type ToolPolicyDecision, type ToolRisk } from './tool.js';

export type PermissionRuleEffect = 'allow' | 'ask' | 'deny';
export type PermissionRuleSource = 'policy' | 'workspace' | 'user' | 'session';

export type PermissionRule = {
  id: string;
  effect: PermissionRuleEffect;
  source: PermissionRuleSource;
  toolGlob: string;
  risk?: ToolRisk;
  pathGlob?: string;
  commandPrefix?: string;
};

const EFFECT_RANK: Record<PermissionRuleEffect, number> = { deny: 3, ask: 2, allow: 1 };
const SOURCE_RANK: Record<PermissionRuleSource, number> = { policy: 4, workspace: 3, user: 2, session: 1 };
const TOOL_RISKS = new Set<ToolRisk>(['read', 'write', 'execute', 'network']);
const MAX_RULES = 200;
const MAX_VALUE_LENGTH = 512;

export function normalizePermissionRules(
  raw: unknown,
  source: PermissionRuleSource,
  allowedEffects: readonly PermissionRuleEffect[],
): PermissionRule[] {
  const values = readRuleArray(raw);
  if (values.length > MAX_RULES) throw new Error(`Permission rule limit exceeded (${MAX_RULES}).`);
  const effects = new Set(allowedEffects);

  return values.map((value, index) => {
    if (!isObject(value)) throw new Error(`Permission rule ${index + 1} must be an object.`);
    const effect = readEnum(value.effect, effects, `Permission rule ${index + 1} has an invalid effect.`);
    const toolGlob = readRequiredString(value.toolGlob, `Permission rule ${index + 1} requires toolGlob.`);
    const id = readOptionalString(value.id) || `${source}-${index + 1}`;
    const risk = value.risk === undefined ? undefined : readEnum(value.risk, TOOL_RISKS, `Permission rule ${index + 1} has an invalid risk.`);
    const pathGlob = readOptionalString(value.pathGlob);
    const commandPrefix = readOptionalString(value.commandPrefix);
    return { id, effect, source, toolGlob, risk, pathGlob, commandPrefix };
  });
}

export function evaluateToolPermission(
  tool: AgentToolDefinition | undefined,
  permissionMode: PermissionMode,
  args: Record<string, unknown>,
  rules: readonly PermissionRule[],
): ToolPolicyDecision {
  const baseline = evaluateToolPolicy(tool, permissionMode);
  if (!tool || !baseline.allowed) return baseline;

  const matched = rules
    .filter((rule) => matchesRule(rule, tool, args))
    .sort(compareRules)[0];
  if (!matched) return baseline;

  const matchedRule = { id: matched.id, effect: matched.effect, source: matched.source };
  if (matched.effect === 'deny') {
    return { allowed: false, requiresApproval: false, reason: `${tool.name} is denied by central permission policy.`, matchedRule };
  }
  if (matched.effect === 'ask') return { allowed: true, requiresApproval: true, matchedRule };
  return { allowed: true, requiresApproval: false, matchedRule };
}

export function matchesPermissionGlob(pattern: string, candidate: string): boolean {
  let patternIndex = 0;
  let candidateIndex = 0;
  let starIndex = -1;
  let retryIndex = 0;

  while (candidateIndex < candidate.length) {
    if (patternIndex < pattern.length && (pattern[patternIndex] === '?' || pattern[patternIndex] === candidate[candidateIndex])) {
      patternIndex += 1;
      candidateIndex += 1;
    } else if (patternIndex < pattern.length && pattern[patternIndex] === '*') {
      starIndex = patternIndex;
      retryIndex = candidateIndex;
      patternIndex += 1;
    } else if (starIndex >= 0) {
      patternIndex = starIndex + 1;
      retryIndex += 1;
      candidateIndex = retryIndex;
    } else {
      return false;
    }
  }
  while (patternIndex < pattern.length && pattern[patternIndex] === '*') patternIndex += 1;
  return patternIndex === pattern.length;
}

function matchesRule(rule: PermissionRule, tool: AgentToolDefinition, args: Record<string, unknown>) {
  if (!matchesPermissionGlob(rule.toolGlob, tool.name)) return false;
  if (rule.risk && rule.risk !== tool.risk) return false;
  if (rule.pathGlob && !readPaths(args).some((value) => matchesPermissionGlob(rule.pathGlob!.replaceAll('\\', '/'), value))) return false;
  if (rule.commandPrefix && !readCommand(args).startsWith(rule.commandPrefix)) return false;
  return true;
}

function compareRules(left: PermissionRule, right: PermissionRule) {
  return EFFECT_RANK[right.effect] - EFFECT_RANK[left.effect]
    || SOURCE_RANK[right.source] - SOURCE_RANK[left.source]
    || ruleSpecificity(right) - ruleSpecificity(left)
    || left.id.localeCompare(right.id);
}

function ruleSpecificity(rule: PermissionRule) {
  return Number(Boolean(rule.risk)) + Number(Boolean(rule.pathGlob)) + Number(Boolean(rule.commandPrefix));
}

function readPaths(args: Record<string, unknown>) {
  return ['path', 'dir', 'filePath']
    .map((key) => args[key])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.replaceAll('\\', '/').replace(/^\.\//, ''));
}

function readCommand(args: Record<string, unknown>) {
  return typeof args.command === 'string' ? args.command.trim() : '';
}

function readRuleArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (isObject(raw) && Array.isArray(raw.rules)) return raw.rules;
  throw new Error('Permission rules must be an array or an object containing a rules array.');
}

function readRequiredString(value: unknown, message: string) {
  const result = readOptionalString(value);
  if (!result) throw new Error(message);
  return result;
}

function readOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('Permission rule string values must be strings.');
  const result = value.trim();
  if (!result || result.length > MAX_VALUE_LENGTH || result.includes('\0')) throw new Error('Permission rule string value is invalid.');
  return result;
}

function readEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>, message: string): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) throw new Error(message);
  return value as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
