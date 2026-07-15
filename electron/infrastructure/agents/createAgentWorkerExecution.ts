import type { AgentProviderSettings } from '../../domain/entities/agent.js';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';
import type { ISubagentProfileProvider } from '../../domain/ports/ISubagentProfileProvider.js';
import type { IToolApprovalGateway } from '../../domain/ports/IToolApprovalGateway.js';
import type { IToolAuditLogger } from '../../domain/ports/IToolAuditLogger.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { IToolPermissionPolicy } from '../../domain/ports/IToolPermissionPolicy.js';
import { AgentProfileToolPlatform } from '../../application/services/AgentProfileToolPlatform.js';
import { AgentWorkerToolPlatform } from '../../application/services/AgentWorkerToolPlatform.js';
import { AgentTeamToolPlatform } from '../../application/services/AgentTeamToolPlatform.js';
import { BackgroundCommandToolPlatform } from '../../application/services/BackgroundCommandToolPlatform.js';
import { FixedWorkspaceToolPlatform } from '../../application/services/FixedWorkspaceToolPlatform.js';
import { TaskToolPlatform } from '../../application/services/TaskToolPlatform.js';
import { ToolSearchPlatform } from '../../application/services/ToolSearchPlatform.js';
import { extractLoadedToolNames } from '../../application/services/toolSearchHistory.js';
import { RunAgentSession } from '../../application/usecases/RunAgentSession.js';
import type { ManageAgentWorkers, AgentWorkerExecution } from '../../application/usecases/ManageAgentWorkers.js';
import type { ManageAgentWorkItems } from '../../application/usecases/ManageAgentWorkItems.js';
import type { ManageAgentTeams } from '../../application/usecases/ManageAgentTeams.js';
import type { ManageAgentWorktrees } from '../../application/usecases/ManageAgentWorktrees.js';
import type { ManageBackgroundCommands } from '../../application/usecases/ManageBackgroundCommands.js';
import type { IAttachmentMessageFormatter } from '../../domain/ports/IAttachmentMessageFormatter.js';
import type { IAgentWorkerEventSink } from '../../domain/ports/IAgentWorkerEventSink.js';
import { AgentWorkerRuntime } from './AgentWorkerRuntime.js';

type Dependencies = {
  provider: IAiProvider;
  settings: AgentProviderSettings;
  baseCatalog: IToolCatalog;
  baseExecutor: IToolExecutor;
  workers: ManageAgentWorkers;
  teams: ManageAgentTeams;
  workItems: ManageAgentWorkItems;
  backgroundCommands: ManageBackgroundCommands;
  worktrees: ManageAgentWorktrees;
  profiles: ISubagentProfileProvider;
  formatter: IAttachmentMessageFormatter;
  approval: IToolApprovalGateway;
  audit: IToolAuditLogger;
  tracer: IAgentTracer;
  policy: IToolPermissionPolicy;
  hooks: ILifecycleHookDispatcher;
  events: IAgentWorkerEventSink;
};

export function createAgentWorkerExecution(dependencies: Dependencies): AgentWorkerExecution {
  let execution: AgentWorkerExecution;
  const runner = new AgentWorkerRuntime(
    dependencies.settings,
    dependencies.worktrees,
    async (worker, workspaceRoot) => createWorkerSession(dependencies, execution, worker, workspaceRoot),
    dependencies.events,
  );
  execution = { runner, events: dependencies.events };
  return execution;
}

async function createWorkerSession(dependencies: Dependencies, execution: AgentWorkerExecution, worker: AgentWorkerRecord, workspaceRoot: string) {
  const agentPlatform = new AgentWorkerToolPlatform(
    dependencies.baseCatalog, dependencies.baseExecutor, dependencies.workers, execution,
    { parentScopeId: worker.parentScopeId, parentAgentId: worker.id, depth: worker.depth },
  );
  const teamContext = {
    scopeId: worker.parentScopeId, parentAgentId: worker.id, depth: worker.depth,
  };
  const teamPlatform = new AgentTeamToolPlatform(
    agentPlatform, agentPlatform, dependencies.teams, execution, teamContext,
  );
  const taskPlatform = new TaskToolPlatform(
    teamPlatform, teamPlatform, dependencies.workItems,
    {
      taskListId: () => dependencies.teams.taskListId(worker.parentScopeId), requestId: worker.id,
      ...(worker.teamName && worker.name ? {
        actorName: worker.name,
        onOwnerChanged: (item) => dependencies.teams.assignTask(worker.parentScopeId, item, {
          ...teamContext, workspaceRoot, permissionMode: worker.permissionMode,
        }, execution),
      } : {}),
    },
  );
  const backgroundPlatform = new BackgroundCommandToolPlatform(
    taskPlatform, taskPlatform, dependencies.backgroundCommands, worker.id,
  );
  const profile = worker.subagentType ? await dependencies.profiles.load(workspaceRoot, worker.subagentType) : undefined;
  const profilePlatform = new AgentProfileToolPlatform(backgroundPlatform, backgroundPlatform, profile?.allowedTools);
  const fixedPlatform = new FixedWorkspaceToolPlatform(profilePlatform, profilePlatform, workspaceRoot);
  const toolPlatform = new ToolSearchPlatform(
    fixedPlatform, fixedPlatform, fixedPlatform, extractLoadedToolNames(worker.messages),
  );
  const session = new RunAgentSession(
    dependencies.provider, toolPlatform, toolPlatform, dependencies.formatter,
    dependencies.approval, dependencies.audit, dependencies.tracer, dependencies.policy, dependencies.hooks,
  );
  const guidanceContext = profile
    ? `<agent-profile name="${profile.name}">\n${profile.instructions}\n</agent-profile>`
    : undefined;
  return { session, toolPlatform, guidanceContext };
}
