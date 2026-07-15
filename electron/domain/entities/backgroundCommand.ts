import type { PermissionMode } from './agent.js';

export type BackgroundCommandStatus = 'running' | 'completed' | 'failed' | 'stopped';

export type BackgroundCommandSnapshot = {
  id: string;
  scopeId: string;
  command: string;
  description: string;
  workspaceRoot: string;
  permissionMode: PermissionMode;
  status: BackgroundCommandStatus;
  startedAt: string;
  endedAt?: string;
  exitCode: number | null;
  outputBytes: number;
  outputTruncated: boolean;
  error?: string;
};

export type StartBackgroundCommandInput = {
  scopeId: string;
  command: string;
  description: string;
  workspaceRoot: string;
  permissionMode: PermissionMode;
  timeoutMs: number;
};

export type BackgroundCommandOutput = {
  retrievalStatus: 'success' | 'timeout' | 'not_ready';
  task: BackgroundCommandSnapshot;
  output: string;
};

export function isTerminalBackgroundCommandStatus(status: BackgroundCommandStatus) {
  return status === 'completed' || status === 'failed' || status === 'stopped';
}
