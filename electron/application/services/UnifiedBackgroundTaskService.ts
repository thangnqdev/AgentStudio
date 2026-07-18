import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { BackgroundCommandOutput, BackgroundCommandSnapshot } from '../../domain/entities/backgroundCommand.js';
import type { BackgroundCommandOutputRequest } from './backgroundCommandInput.js';
import type { ManageAgentWorkers } from '../usecases/ManageAgentWorkers.js';
import type { ManageBackgroundCommands } from '../usecases/ManageBackgroundCommands.js';

export type UnifiedTaskOutput =
  | { taskType: 'local_agent'; retrievalStatus: 'success' | 'timeout' | 'not_ready'; task: AgentWorkerRecord }
  | { taskType: 'local_bash'; result: BackgroundCommandOutput };

export type UnifiedStoppedTask =
  | { taskType: 'local_agent'; id: string; description: string }
  | { taskType: 'local_bash'; task: BackgroundCommandSnapshot };

export class UnifiedBackgroundTaskService {
  private readonly commands: ManageBackgroundCommands;
  private readonly workers?: ManageAgentWorkers;

  constructor(commands: ManageBackgroundCommands, workers?: ManageAgentWorkers) {
    this.commands = commands; this.workers = workers;
  }

  async output(commandScopeId: string, agentScopeId: string, request: BackgroundCommandOutputRequest, signal?: AbortSignal): Promise<UnifiedTaskOutput> {
    const worker = await this.workers?.findInScope(agentScopeId, request.taskId);
    if (!worker) return { taskType: 'local_bash', result: await this.commands.output(commandScopeId, request, signal) };
    if (!request.block || worker.status !== 'running') {
      return { taskType: 'local_agent', retrievalStatus: worker.status === 'running' ? 'not_ready' : 'success', task: worker };
    }
    const completed = await waitForWorker(this.workers!, agentScopeId, worker, request.timeoutMs, signal);
    return { taskType: 'local_agent', retrievalStatus: completed.status === 'running' ? 'timeout' : 'success', task: completed };
  }

  async stop(commandScopeId: string, agentScopeId: string, taskId: string): Promise<UnifiedStoppedTask> {
    const worker = await this.workers?.findInScope(agentScopeId, taskId);
    if (!worker) return { taskType: 'local_bash', task: await this.commands.stop(commandScopeId, taskId) };
    if (worker.status !== 'running') throw new Error(`Task ${taskId} is not running (status: ${worker.status}).`);
    if (!await this.workers!.stopInScope(agentScopeId, taskId)) throw new Error(`Unable to stop task ${taskId}.`);
    return { taskType: 'local_agent', id: taskId, description: worker.description };
  }
}

async function waitForWorker(
  workers: ManageAgentWorkers,
  scopeId: string,
  initial: AgentWorkerRecord,
  timeoutMs: number,
  signal?: AbortSignal,
) {
  const deadline = Date.now() + timeoutMs;
  let current = initial;
  while (current.status === 'running' && Date.now() < deadline) {
    await abortableDelay(Math.min(100, Math.max(0, deadline - Date.now())), signal);
    current = await workers.findInScope(scopeId, initial.id) ?? current;
  }
  return current;
}

function abortableDelay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Agent session stopped.')); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Agent session stopped.')); }, { once: true });
  });
}
