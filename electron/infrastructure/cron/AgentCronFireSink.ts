import type { Message } from '../../domain/entities/agent.js';
import type { CronScope, CronTask } from '../../domain/entities/cron.js';
import type { ICronFireSink } from '../../domain/ports/ICronFireSink.js';
import type { IAgentWorkerRepository } from '../../domain/ports/IAgentWorkerRepository.js';

export class AgentCronFireSink implements ICronFireSink {
  private readonly workers: IAgentWorkerRepository;
  private readonly teammateDeliveries = new Map<string, (scope: CronScope, content: string) => Promise<void>>();

  constructor(workers: IAgentWorkerRepository) { this.workers = workers; }

  registerTeammateDelivery(scopeId: string, delivery: (scope: CronScope, content: string) => Promise<void>) {
    this.teammateDeliveries.set(scopeId, delivery);
    return () => {
      if (this.teammateDeliveries.get(scopeId) === delivery) this.teammateDeliveries.delete(scopeId);
    };
  }

  clear() { this.teammateDeliveries.clear(); }

  async fire(scope: CronScope, task: CronTask) {
    const content = `<cron-event id="${task.id}" schedule="${escapeXml(task.cron)}">\n${escapeXml(task.prompt)}\n</cron-event>`;
    if (scope.ownerKind === 'teammate') {
      const delivery = this.teammateDeliveries.get(scope.scopeId);
      if (delivery) {
        await delivery(scope, content);
        return;
      }
      const message: Message = { id: `cron-${task.id}-${crypto.randomUUID()}`, sender: 'user', content };
      await this.workers.enqueueMessage(scope.ownerId, message);
      return;
    }
    await this.workers.addNotification({
      id: crypto.randomUUID(), parentScopeId: scope.scopeId, agentId: `cron-${task.id}`,
      agentName: 'cron', status: 'paused', message: content, createdAt: new Date().toISOString(),
    });
  }
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
