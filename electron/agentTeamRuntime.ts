import { app } from 'electron';
import path from 'node:path';
import { AgentTeamProtocolRouter } from './application/services/AgentTeamProtocolRouter.js';
import type { ManageAgentWorkItems } from './application/usecases/ManageAgentWorkItems.js';
import { ManageAgentTeams } from './application/usecases/ManageAgentTeams.js';
import { PublishAgentTeamIdle } from './application/usecases/PublishAgentTeamIdle.js';
import { ResolveAgentTeamControl } from './application/usecases/ResolveAgentTeamControl.js';
import type { ManageAgentWorkers } from './application/usecases/ManageAgentWorkers.js';
import type { IAgentWorkerRepository } from './domain/ports/IAgentWorkerRepository.js';
import type { IToolApprovalGateway } from './domain/ports/IToolApprovalGateway.js';
import { AgentTeamProtocolQueueDelivery } from './infrastructure/agents/AgentTeamProtocolQueueDelivery.js';
import { ElectronAgentTeamEventHub } from './infrastructure/agents/ElectronAgentTeamEventHub.js';
import { LocalAgentTeamSocketTransport } from './infrastructure/agents/LocalAgentTeamSocketTransport.js';
import { PrivateAgentTeamProtocolStore } from './infrastructure/agents/PrivateAgentTeamProtocolStore.js';
import { PrivateAgentTeamRepository } from './infrastructure/agents/PrivateAgentTeamRepository.js';
import { TeamScopedCredentialService } from './infrastructure/agents/TeamScopedCredentialService.js';
import type { ILifecycleHookDispatcher } from './domain/ports/ILifecycleHookDispatcher.js';

export function createAgentTeamRuntime(
  workers: ManageAgentWorkers,
  workerRepository: IAgentWorkerRepository,
  workItems: ManageAgentWorkItems,
  approvals: IToolApprovalGateway,
  hooks?: ILifecycleHookDispatcher,
) {
  const directory = () => path.join(app.getPath('userData'), 'agent-team-protocol');
  const teamRepository = new PrivateAgentTeamRepository(() => path.join(app.getPath('userData'), 'agent-teams'));
  const credentials = new TeamScopedCredentialService();
  const transport = new LocalAgentTeamSocketTransport(() => path.join(directory(), 'socket'), credentials);
  const router = new AgentTeamProtocolRouter(
    new PrivateAgentTeamProtocolStore(() => path.join(directory(), 'mailbox')),
    teamRepository,
    transport,
  );
  const events = new ElectronAgentTeamEventHub();
  const controls = new ResolveAgentTeamControl(
    workerRepository, teamRepository, approvals, router,
    (scopeId, worker, action) => events.emitWorkerEvent({ scopeId, worker, action }),
  );
  const queueDelivery = new AgentTeamProtocolQueueDelivery(teamRepository, workerRepository, controls);
  const manager = new ManageAgentTeams(teamRepository, workers, workItems, events, undefined, router);
  const idlePublisher = new PublishAgentTeamIdle(teamRepository, router, hooks);
  const ready = app.whenReady().then(() => router.start((message) => queueDelivery.deliver(message))).then(() => true).catch(() => false);
  return {
    manager, events, router, credentials, idlePublisher, ready,
    async stop() { await router.shutdown().catch(() => undefined); credentials.clear(); },
  };
}
