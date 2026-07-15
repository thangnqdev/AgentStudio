import type { PermissionMode } from '../../domain/entities/agent.js';
import type { IBackgroundCommandSupervisor } from '../../domain/ports/IBackgroundCommandSupervisor.js';
import type {
  BackgroundCommandOutputRequest,
  BackgroundCommandStartRequest,
} from '../services/backgroundCommandInput.js';

export class ManageBackgroundCommands {
  private readonly supervisor: IBackgroundCommandSupervisor;

  constructor(supervisor: IBackgroundCommandSupervisor) {
    this.supervisor = supervisor;
  }

  start(
    scopeId: string,
    request: BackgroundCommandStartRequest,
    context: { workspaceRoot: string; permissionMode: PermissionMode },
  ) {
    return this.supervisor.start({
      scopeId,
      command: request.command,
      description: request.description,
      timeoutMs: request.timeoutMs,
      workspaceRoot: context.workspaceRoot,
      permissionMode: context.permissionMode,
    });
  }

  async output(scopeId: string, request: BackgroundCommandOutputRequest, signal?: AbortSignal) {
    const result = await this.supervisor.output(scopeId, request.taskId, {
      block: request.block,
      timeoutMs: request.timeoutMs,
      signal,
    });
    if (!result) throw new Error(`No background command found with ID: ${request.taskId}`);
    return result;
  }

  async stop(scopeId: string, taskId: string) {
    const task = await this.supervisor.stop(scopeId, taskId);
    if (!task) throw new Error(`No background command found with ID: ${taskId}`);
    if (task.status !== 'stopped') throw new Error(`Background command ${taskId} is not running (status: ${task.status}).`);
    return task;
  }
}
