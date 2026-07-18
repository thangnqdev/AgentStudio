import path from 'node:path';
import type { BackgroundCommandSnapshot } from '../../domain/entities/backgroundCommand.js';
import type { SandboxCommandSpec } from '../tools/sandbox/SandboxCommandSpec.js';

export const BACKGROUND_PROCESS_PROTOCOL_VERSION = 1;
export const MAX_BACKGROUND_PROCESS_MESSAGE_BYTES = 64_000;
export const BACKGROUND_CONTROL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type BackgroundCommandProcessState = {
  version: 1;
  snapshot: BackgroundCommandSnapshot;
  timeoutAt: string;
  heartbeatAt: string;
  controlToken: string;
  supervisorPid: number;
  notificationDeliveredAt?: string;
  rendererDeliveredAt?: string;
};

export type BackgroundCommandProcessBootstrap = {
  version: 1;
  directory: string;
  state: BackgroundCommandProcessState;
  command: SandboxCommandSpec;
};

export function parseBackgroundCommandProcessBootstrap(value: unknown): BackgroundCommandProcessBootstrap {
  const object = asObject(value, 'Background command bootstrap');
  if (object.version !== BACKGROUND_PROCESS_PROTOCOL_VERSION) throw new Error('Background command protocol version is invalid.');
  const directory = requiredString(object.directory, 'directory', 4_096);
  if (!path.isAbsolute(directory) || directory.includes('\0')) throw new Error('Background command directory is invalid.');
  const command = parseCommandSpec(object.command);
  return {
    version: BACKGROUND_PROCESS_PROTOCOL_VERSION,
    directory,
    state: parseBackgroundCommandProcessState(object.state),
    command,
  };
}

export function parseBackgroundCommandProcessState(value: unknown): BackgroundCommandProcessState {
  const object = asObject(value, 'Background command state');
  if (object.version !== BACKGROUND_PROCESS_PROTOCOL_VERSION) throw new Error('Background command state version is invalid.');
  const snapshot = parseSnapshot(object.snapshot);
  const timeoutAt = validDate(object.timeoutAt, 'timeoutAt');
  const heartbeatAt = validDate(object.heartbeatAt, 'heartbeatAt');
  const controlToken = requiredString(object.controlToken, 'controlToken', 64);
  if (!BACKGROUND_CONTROL_TOKEN_PATTERN.test(controlToken)) throw new Error('Background command control token is invalid.');
  const supervisorPid = safeInteger(object.supervisorPid, 'supervisorPid', 1);
  return {
    version: 1, snapshot, timeoutAt, heartbeatAt, controlToken, supervisorPid,
    ...(object.notificationDeliveredAt === undefined
      ? {} : { notificationDeliveredAt: validDate(object.notificationDeliveredAt, 'notificationDeliveredAt') }),
    ...(object.rendererDeliveredAt === undefined
      ? {} : { rendererDeliveredAt: validDate(object.rendererDeliveredAt, 'rendererDeliveredAt') }),
  };
}

export function parseBackgroundCommandControl(value: unknown) {
  const object = asObject(value, 'Background command control request');
  if (object.action !== 'stop') throw new Error('Background command control action is invalid.');
  const token = requiredString(object.token, 'token', 64);
  if (!BACKGROUND_CONTROL_TOKEN_PATTERN.test(token)) throw new Error('Background command control token is invalid.');
  return { action: 'stop' as const, token };
}

function parseCommandSpec(value: unknown): SandboxCommandSpec {
  const object = asObject(value, 'Background command specification');
  const executable = requiredString(object.executable, 'executable', 4_096);
  const cwd = requiredString(object.cwd, 'cwd', 4_096);
  if (!path.isAbsolute(cwd) || cwd.includes('\0') || executable.includes('\0')) throw new Error('Background command specification is invalid.');
  if (!Array.isArray(object.args) || object.args.length > 512) throw new Error('Background command arguments are invalid.');
  const args = object.args.map((item) => requiredString(item, 'argument', 20_000, true));
  return { executable, args, cwd };
}

function parseSnapshot(value: unknown): BackgroundCommandSnapshot {
  const object = asObject(value, 'Background command snapshot');
  const status = object.status;
  if (!['running', 'completed', 'failed', 'stopped'].includes(String(status))) throw new Error('Background command status is invalid.');
  const permissionMode = object.permissionMode;
  if (!['read-only', 'workspace-write', 'danger-full-access'].includes(String(permissionMode))) {
    throw new Error('Background command permission mode is invalid.');
  }
  const exitCode = object.exitCode === null ? null : safeInteger(object.exitCode, 'exitCode', -2_147_483_648);
  return {
    id: requiredString(object.id, 'id', 128),
    scopeId: requiredString(object.scopeId, 'scopeId', 128),
    command: requiredString(object.command, 'command', 20_000),
    description: requiredString(object.description, 'description', 500),
    workspaceRoot: absoluteString(object.workspaceRoot, 'workspaceRoot'),
    permissionMode: permissionMode as BackgroundCommandSnapshot['permissionMode'],
    status: status as BackgroundCommandSnapshot['status'],
    startedAt: validDate(object.startedAt, 'startedAt'),
    ...(object.endedAt === undefined ? {} : { endedAt: validDate(object.endedAt, 'endedAt') }),
    exitCode,
    outputBytes: safeInteger(object.outputBytes, 'outputBytes', 0),
    outputTruncated: requiredBoolean(object.outputTruncated, 'outputTruncated'),
    ...(object.error === undefined ? {} : { error: requiredString(object.error, 'error', 2_000) }),
  };
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is invalid.`);
  return value as Record<string, unknown>;
}
function requiredString(value: unknown, field: string, max: number, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value) || value.length > max) throw new Error(`Background command ${field} is invalid.`);
  return value;
}
function absoluteString(value: unknown, field: string) {
  const result = requiredString(value, field, 4_096);
  if (!path.isAbsolute(result) || result.includes('\0')) throw new Error(`Background command ${field} is invalid.`);
  return result;
}
function validDate(value: unknown, field: string) {
  const result = requiredString(value, field, 64);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`Background command ${field} is invalid.`);
  return result;
}
function safeInteger(value: unknown, field: string, minimum: number) {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error(`Background command ${field} is invalid.`);
  return value as number;
}
function requiredBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') throw new Error(`Background command ${field} is invalid.`);
  return value;
}
