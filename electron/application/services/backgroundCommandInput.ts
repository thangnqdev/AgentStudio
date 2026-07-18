const MAX_COMMAND_CHARS = 20_000;
const MAX_DESCRIPTION_CHARS = 500;
const MAX_BACKGROUND_TIMEOUT_MS = 600_000;
const MAX_OUTPUT_WAIT_MS = 600_000;

export type BackgroundCommandStartRequest = {
  command: string;
  description: string;
  timeoutMs: number;
  shell?: 'powershell';
};

export type BackgroundCommandOutputRequest = {
  taskId: string;
  block: boolean;
  timeoutMs: number;
};

export function wantsBackgroundCommand(args: Record<string, unknown>) {
  return args.run_in_background === true || args.runInBackground === true;
}

export function parseBackgroundCommandStart(args: Record<string, unknown>): BackgroundCommandStartRequest {
  const command = getRequiredString(args.command, 'command', MAX_COMMAND_CHARS);
  const description = getOptionalString(args.description, 'description', MAX_DESCRIPTION_CHARS) || command.slice(0, 160);
  return {
    command,
    description,
    timeoutMs: boundedInteger(args.timeoutMs, 120_000, 1_000, MAX_BACKGROUND_TIMEOUT_MS, 'timeoutMs'),
    ...(args.shell === 'powershell' ? { shell: 'powershell' as const } : {}),
  };
}

export function parseBackgroundCommandOutput(args: Record<string, unknown>): BackgroundCommandOutputRequest {
  const legacyWait = args.wait_up_to;
  const timeout = args.timeout ?? args.timeoutMs ?? (
    legacyWait === undefined ? undefined : legacyWaitInMilliseconds(legacyWait)
  );
  return {
    taskId: getRequiredString(args.task_id ?? args.taskId ?? args.agentId ?? args.agent_id ?? args.bash_id ?? args.shell_id, 'task_id', 128),
    block: args.block === undefined ? true : getBoolean(args.block, 'block'),
    timeoutMs: boundedInteger(timeout, 30_000, 0, MAX_OUTPUT_WAIT_MS, 'timeout'),
  };
}

export function parseBackgroundCommandTaskId(args: Record<string, unknown>) {
  return getRequiredString(args.task_id ?? args.taskId ?? args.shell_id ?? args.agent_id, 'task_id', 128);
}

function getRequiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${field} exceeds ${maxLength} characters.`);
  return normalized;
}

function getOptionalString(value: unknown, field: string, maxLength: number) {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${field} exceeds ${maxLength} characters.`);
  return normalized;
}

function getBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean.`);
  return value;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number, field: string) {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function legacyWaitInMilliseconds(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error('wait_up_to must be an integer.');
  return value * 1_000;
}
