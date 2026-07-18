import { describe, expect, it, vi } from 'vitest';
import type { IAgentWorkerRepository } from '../../domain/ports/IAgentWorkerRepository.js';
import { AgentCronFireSink } from './AgentCronFireSink.js';

describe('AgentCronFireSink', () => {
  it('persists lead prompts as parent notifications and teammate prompts in their inbox', async () => {
    const workers = {
      addNotification: vi.fn(async () => undefined), enqueueMessage: vi.fn(async () => undefined),
    } as unknown as IAgentWorkerRepository;
    const sink = new AgentCronFireSink(workers);
    const task = { id: '1234abcd', cron: '* * * * *', prompt: '<check>', createdAt: 1, recurring: false, durable: false };
    await sink.fire({ workspaceRoot: '/workspace', scopeId: 'scope', ownerId: 'lead:scope', ownerKind: 'lead' }, task);
    expect(workers.addNotification).toHaveBeenCalledWith(expect.objectContaining({ parentScopeId: 'scope', message: expect.stringContaining('&lt;check&gt;') }));
    await sink.fire({ workspaceRoot: '/workspace', scopeId: 'scope', ownerId: 'worker-1', ownerKind: 'teammate' }, task);
    expect(workers.enqueueMessage).toHaveBeenCalledWith('worker-1', expect.objectContaining({ content: expect.stringContaining('<cron-event') }));
  });

  it('uses a registered live delivery to wake a stopped teammate', async () => {
    const workers = { enqueueMessage: vi.fn(), addNotification: vi.fn() } as unknown as IAgentWorkerRepository;
    const sink = new AgentCronFireSink(workers);
    const delivery = vi.fn(async () => undefined);
    const unregister = sink.registerTeammateDelivery('scope', delivery);
    await sink.fire(
      { workspaceRoot: '/workspace', scopeId: 'scope', ownerId: 'worker-1', ownerKind: 'teammate' },
      { id: '1234abcd', cron: '* * * * *', prompt: 'check', createdAt: 1, recurring: false, durable: false },
    );
    expect(delivery).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'worker-1' }), expect.stringContaining('<cron-event'));
    expect(workers.enqueueMessage).not.toHaveBeenCalled();
    unregister();
    await sink.fire(
      { workspaceRoot: '/workspace', scopeId: 'scope', ownerId: 'worker-1', ownerKind: 'teammate' },
      { id: '5678efgh', cron: '* * * * *', prompt: 'later', createdAt: 2, recurring: false, durable: false },
    );
    expect(workers.enqueueMessage).toHaveBeenCalledWith('worker-1', expect.objectContaining({ content: expect.stringContaining('later') }));
  });
});
