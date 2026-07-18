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
import { CompatibilityToolPlatform } from '../../application/services/CompatibilityToolPlatform.js';
import type { CronPlatformIdentity } from '../../application/services/CronToolPlatform.js';
import { extractLoadedToolNames } from '../../application/services/toolSearchHistory.js';
import { RunAgentSession } from '../../application/usecases/RunAgentSession.js';
import type { ManageAgentWorkers, AgentWorkerExecution } from '../../application/usecases/ManageAgentWorkers.js';
import type { ManageAgentWorkItems } from '../../application/usecases/ManageAgentWorkItems.js';
import type { ManageAgentTeams } from '../../application/usecases/ManageAgentTeams.js';
import type { ManageAgentWorktrees } from '../../application/usecases/ManageAgentWorktrees.js';
import type { ManageBackgroundCommands } from '../../application/usecases/ManageBackgroundCommands.js';
import type { IAttachmentMessageFormatter } from '../../domain/ports/IAttachmentMessageFormatter.js';
import type { IAgentWorkerEventSink } from '../../domain/ports/IAgentWorkerEventSink.js';
import type { IAgentAmbientContextSource } from '../../domain/ports/IAgentAmbientContextSource.js';
import { AgentWorkerRuntime } from './AgentWorkerRuntime.js';
import { ProcessIsolatedAgentWorkerRuntime } from './ProcessIsolatedAgentWorkerRuntime.js';
import type { IAgentWorkerSessionProcessHost } from '../../domain/ports/IAgentWorkerSessionProcessHost.js';
import { AgentToolCallRunner } from '../../application/services/AgentToolCallRunner.js';
import { LifecycleAwareAgentWorkerRunner } from '../../application/services/LifecycleAwareAgentWorkerRunner.js';

type Dependencies = {
  provider: IAiProvider;
  settings: AgentProviderSettings;
  baseCatalog: IToolCatalog;
  baseExecutor: IToolExecutor;
  createSessionBasePlatform?: () => { catalog: IToolCatalog; executor: IToolExecutor };
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
  ambientContext?: IAgentAmbientContextSource;
  events: IAgentWorkerEventSink;
  cron?: {
    decorate(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor, identity: CronPlatformIdentity): IToolCatalog & IToolExecutor;
  };
  remoteTriggers?: {
    decorate(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor): IToolCatalog & IToolExecutor;
  };
  processHost?: IAgentWorkerSessionProcessHost;
};

export function createAgentWorkerExecution(dependencies: Dependencies): AgentWorkerExecution {
  let execution: AgentWorkerExecution;
  const runtime = dependencies.processHost
    ? new ProcessIsolatedAgentWorkerRuntime(
      dependencies.settings, dependencies.worktrees,
      async (worker, workspaceRoot) => createWorkerProcessContext(dependencies, execution, worker, workspaceRoot),
      dependencies.events, dependencies.processHost, dependencies.tracer,
    )
    : new AgentWorkerRuntime(
      dependencies.settings,
      dependencies.worktrees,
      async (worker, workspaceRoot) => createWorkerSession(dependencies, execution, worker, workspaceRoot),
      dependencies.events,
    );
  const runner = new LifecycleAwareAgentWorkerRunner(runtime, dependencies.hooks);
  execution = { runner, events: dependencies.events };
  return execution;
}

async function createWorkerSession(dependencies: Dependencies, execution: AgentWorkerExecution, worker: AgentWorkerRecord, workspaceRoot: string) {
  const context = await createWorkerPlatform(dependencies, execution, worker, workspaceRoot);
  const session = new RunAgentSession(
    dependencies.provider, context.toolPlatform, context.toolPlatform, dependencies.formatter,
    dependencies.approval, dependencies.audit, dependencies.tracer, dependencies.policy, dependencies.hooks,
    dependencies.ambientContext,
  );
  return { session, ...context };
}

async function createWorkerProcessContext(dependencies: Dependencies, execution: AgentWorkerExecution, worker: AgentWorkerRecord, workspaceRoot: string) {
  const context = await createWorkerPlatform(dependencies, execution, worker, workspaceRoot);
  return {
    ...context,
    hooks: dependencies.hooks,
    toolRunner: new AgentToolCallRunner(
      context.toolPlatform, dependencies.approval, dependencies.audit, dependencies.tracer,
      dependencies.policy, dependencies.hooks,
    ),
  };
}

async function createWorkerPlatform(dependencies: Dependencies, execution: AgentWorkerExecution, worker: AgentWorkerRecord, workspaceRoot: string) {
  const sessionBase = dependencies.createSessionBasePlatform?.() ?? {
    catalog: dependencies.baseCatalog,
    executor: dependencies.baseExecutor,
  };
  const agentPlatform = new AgentWorkerToolPlatform(
    sessionBase.catalog, sessionBase.executor, dependencies.workers, execution,
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
    taskPlatform, taskPlatform, dependencies.backgroundCommands, worker.parentScopeId,
    dependencies.workers,
    worker.parentScopeId,
  );
  const profile = worker.subagentType ? await dependencies.profiles.load(workspaceRoot, worker.subagentType) : undefined;
  const profilePlatform = new AgentProfileToolPlatform(backgroundPlatform, backgroundPlatform, profile?.allowedTools);
  const fixedPlatform = new FixedWorkspaceToolPlatform(profilePlatform, profilePlatform, workspaceRoot);
  const cronPlatform = dependencies.cron?.decorate(fixedPlatform, fixedPlatform, {
    scopeId: worker.parentScopeId, ownerId: worker.id, ownerKind: 'teammate',
  }) ?? fixedPlatform;
  const remoteTriggerPlatform = dependencies.remoteTriggers?.decorate(cronPlatform, cronPlatform) ?? cronPlatform;
  const compatibilityPlatform = new CompatibilityToolPlatform(remoteTriggerPlatform, remoteTriggerPlatform);
  const toolPlatform = new ToolSearchPlatform(
    compatibilityPlatform, compatibilityPlatform, fixedPlatform, extractLoadedToolNames(worker.messages),
  );
  const guidanceContext = profile
    ? `<agent-profile name="${profile.name}">\n${profile.instructions}\n</agent-profile>`
    : undefined;
  return { toolPlatform, guidanceContext };
}
