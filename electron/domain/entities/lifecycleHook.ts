import { matchesPermissionGlob } from './permissionGlobMatching.js';

export const LIFECYCLE_HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'StopFailure',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'PermissionRequest',
  'PermissionDenied',
  'Setup',
  'TeammateIdle',
  'TaskCreated',
  'TaskCompleted',
  'Elicitation',
  'ElicitationResult',
  'ConfigChange',
  'WorktreeCreate',
  'WorktreeRemove',
  'InstructionsLoaded',
  'CwdChanged',
  'FileChanged',
] as const;

export type LifecycleHookEvent = typeof LIFECYCLE_HOOK_EVENTS[number];
export type IntegratedLifecycleHookEvent = 'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'PostToolUseFailure';

export type LifecycleHookAction =
  | { type: 'add_context'; content: string }
  | { type: 'deny_tool'; reason: string }
  | { type: 'require_approval'; reason: string }
  | { type: 'audit'; label: string };

export type LifecycleHookDefinition = {
  id: string;
  event: IntegratedLifecycleHookEvent;
  matcher?: string;
  actions: LifecycleHookAction[];
};

export type LifecycleHookResult = {
  matchedHookIds: string[];
  contexts: string[];
  denyReason?: string;
  approvalReason?: string;
  auditLabels: string[];
};

const INTEGRATED_EVENTS = new Set<LifecycleHookEvent>([
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
]);
const TOOL_EVENTS = new Set<LifecycleHookEvent>(['PreToolUse', 'PostToolUse', 'PostToolUseFailure']);
const CONTEXT_EVENTS = new Set<LifecycleHookEvent>(['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'PostToolUseFailure']);
const MAX_HOOKS = 100;
const MAX_ACTIONS_PER_HOOK = 10;
const MAX_ID_LENGTH = 128;
const MAX_MATCHER_LENGTH = 256;
const MAX_CONTEXT_LENGTH = 8_000;
const MAX_REASON_LENGTH = 1_000;

export function normalizeLifecycleHookDocument(raw: unknown): LifecycleHookDefinition[] {
  if (!isObject(raw) || raw.version !== 1 || !isObject(raw.hooks)) {
    throw new Error('Lifecycle hook file must contain version 1 and a hooks object.');
  }
  const definitions: LifecycleHookDefinition[] = [];
  for (const [rawEvent, rawMatchers] of Object.entries(raw.hooks)) {
    if (!isLifecycleHookEvent(rawEvent)) throw new Error(`Unknown lifecycle hook event: ${rawEvent}.`);
    if (!INTEGRATED_EVENTS.has(rawEvent)) throw new Error(`Lifecycle hook event is not integrated yet: ${rawEvent}.`);
    if (!Array.isArray(rawMatchers)) throw new Error(`${rawEvent} hooks must be an array.`);
    for (const [index, value] of rawMatchers.entries()) {
      definitions.push(normalizeDefinition(rawEvent as IntegratedLifecycleHookEvent, value, index));
      if (definitions.length > MAX_HOOKS) throw new Error(`Lifecycle hook limit exceeded (${MAX_HOOKS}).`);
    }
  }
  const ids = new Set<string>();
  for (const definition of definitions) {
    if (ids.has(definition.id)) throw new Error(`Duplicate lifecycle hook id: ${definition.id}.`);
    ids.add(definition.id);
  }
  return definitions;
}

export function evaluateLifecycleHooks(
  definitions: readonly LifecycleHookDefinition[],
  event: IntegratedLifecycleHookEvent,
  matchValue?: string,
): LifecycleHookResult {
  const result: LifecycleHookResult = { matchedHookIds: [], contexts: [], auditLabels: [] };
  for (const definition of definitions) {
    if (definition.event !== event || !matchesHook(definition, matchValue)) continue;
    result.matchedHookIds.push(definition.id);
    for (const action of definition.actions) {
      if (action.type === 'add_context') result.contexts.push(action.content);
      else if (action.type === 'deny_tool' && !result.denyReason) result.denyReason = action.reason;
      else if (action.type === 'require_approval' && !result.approvalReason) result.approvalReason = action.reason;
      else if (action.type === 'audit') result.auditLabels.push(action.label);
    }
  }
  return result;
}

function normalizeDefinition(event: IntegratedLifecycleHookEvent, raw: unknown, index: number): LifecycleHookDefinition {
  if (!isObject(raw) || !Array.isArray(raw.actions) || raw.actions.length === 0) {
    throw new Error(`${event} hook ${index + 1} requires a non-empty actions array.`);
  }
  if (raw.actions.length > MAX_ACTIONS_PER_HOOK) throw new Error(`${event} hook ${index + 1} has too many actions.`);
  const id = readBoundedString(raw.id, MAX_ID_LENGTH, `${event} hook ${index + 1} requires id.`);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(id)) throw new Error(`${event} hook ${index + 1} has an invalid id.`);
  const matcher = raw.matcher === undefined ? undefined : readBoundedString(raw.matcher, MAX_MATCHER_LENGTH, `${id} has an invalid matcher.`);
  if (matcher && !TOOL_EVENTS.has(event)) throw new Error(`${event} hook ${id} cannot declare a matcher.`);
  const actions = raw.actions.map((action, actionIndex) => normalizeAction(event, id, action, actionIndex));
  return { id, event, ...(matcher ? { matcher } : {}), actions };
}

function normalizeAction(event: IntegratedLifecycleHookEvent, hookId: string, raw: unknown, index: number): LifecycleHookAction {
  if (!isObject(raw) || typeof raw.type !== 'string') throw new Error(`${hookId} action ${index + 1} is invalid.`);
  if (raw.type === 'add_context') {
    if (!CONTEXT_EVENTS.has(event)) throw new Error(`${event} hooks cannot add context.`);
    return { type: raw.type, content: readBoundedString(raw.content, MAX_CONTEXT_LENGTH, `${hookId} add_context requires content.`) };
  }
  if (raw.type === 'deny_tool' || raw.type === 'require_approval') {
    if (event !== 'PreToolUse') throw new Error(`${raw.type} is only valid for PreToolUse.`);
    return { type: raw.type, reason: readBoundedString(raw.reason, MAX_REASON_LENGTH, `${hookId} ${raw.type} requires reason.`) };
  }
  if (raw.type === 'audit') {
    return { type: raw.type, label: readBoundedString(raw.label, MAX_ID_LENGTH, `${hookId} audit requires label.`) };
  }
  throw new Error(`${hookId} action ${index + 1} has an unsupported type.`);
}

function matchesHook(definition: LifecycleHookDefinition, matchValue?: string) {
  if (!definition.matcher) return true;
  return typeof matchValue === 'string' && matchesPermissionGlob(definition.matcher, matchValue);
}

function isLifecycleHookEvent(value: string): value is LifecycleHookEvent {
  return (LIFECYCLE_HOOK_EVENTS as readonly string[]).includes(value);
}

function readBoundedString(value: unknown, maximum: number, message: string) {
  if (typeof value !== 'string') throw new Error(message);
  const result = value.trim();
  if (!result || result.length > maximum || result.includes('\0')) throw new Error(message);
  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
