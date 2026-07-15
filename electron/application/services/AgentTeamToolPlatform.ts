import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import {
  TEAM_CREATE_TOOL_DEFINITION,
  TEAM_CREATE_TOOL_NAME,
  TEAM_DELETE_TOOL_DEFINITION,
  TEAM_DELETE_TOOL_NAME,
} from '../../domain/entities/agentTeam.js';
import { AGENT_WORKER_TOOL_NAME, SEND_MESSAGE_TOOL_NAME } from '../../domain/entities/agentWorker.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { AgentWorkerExecution } from '../usecases/ManageAgentWorkers.js';
import type { AgentTeamContext, ManageAgentTeams } from '../usecases/ManageAgentTeams.js';
import { assertDeleteAgentTeamInput, parseCreateAgentTeamInput } from './agentTeamInput.js';
import { parseAgentWorkerSpawnRequest, parseSendMessageRequest } from './agentWorkerInput.js';

const TEAM_TOOL_NAMES = [TEAM_CREATE_TOOL_NAME, TEAM_DELETE_TOOL_NAME] as const;

export class AgentTeamToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly teams: ManageAgentTeams;
  private readonly execution: AgentWorkerExecution;
  private readonly context: Omit<AgentTeamContext, 'workspaceRoot' | 'permissionMode'>;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    teams: ManageAgentTeams,
    execution: AgentWorkerExecution,
    context: Omit<AgentTeamContext, 'workspaceRoot' | 'permissionMode'>,
  ) {
    this.baseCatalog = baseCatalog; this.baseExecutor = baseExecutor; this.teams = teams;
    this.execution = execution; this.context = context;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    const withoutTeams = tools.filter((tool) => !(TEAM_TOOL_NAMES as readonly string[]).includes(tool.name));
    return this.context.parentAgentId
      ? withoutTeams
      : [...withoutTeams, structuredClone(TEAM_CREATE_TOOL_DEFINITION), structuredClone(TEAM_DELETE_TOOL_DEFINITION)];
  }

  async execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal): Promise<ToolResult> {
    if (signal?.aborted) return { ok: false, output: 'Agent session stopped.' };
    const context: AgentTeamContext = { ...this.context, workspaceRoot, permissionMode };
    try {
      if (toolName === TEAM_CREATE_TOOL_NAME) {
        const team = await this.teams.create(parseCreateAgentTeamInput(args), context);
        return { ok: true, output: JSON.stringify({ team_name: team.name, team_file_path: team.id, lead_agent_id: team.leadAgentId, task_list_id: team.taskListId }) };
      }
      if (toolName === TEAM_DELETE_TOOL_NAME) {
        assertDeleteAgentTeamInput(args);
        const team = await this.teams.delete(context);
        return { ok: true, output: `Team "${team.name}" and its shared task list were deleted.` };
      }
      if (toolName === AGENT_WORKER_TOOL_NAME) {
        const request = parseAgentWorkerSpawnRequest(args);
        const activeTeam = await this.teams.get(context.scopeId);
        if (request.name && (request.teamName || activeTeam)) {
          const launched = await this.teams.spawn(request, context, this.execution);
          return { ok: true, output: JSON.stringify({
            status: 'async_launched', agentId: launched.worker.id, name: launched.worker.name,
            team_name: launched.team.name, description: launched.worker.description,
          }) };
        }
      }
      if (toolName === SEND_MESSAGE_TOOL_NAME && await this.teams.get(context.scopeId)) {
        return { ok: true, output: (await this.teams.send(parseSendMessageRequest(args), context, this.execution)).join('\n') };
      }
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Agent team operation failed.' };
    }
  }
}
