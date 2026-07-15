import { describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import { ElectronAgentTeamEventHub } from './ElectronAgentTeamEventHub.js';

describe('ElectronAgentTeamEventHub', () => {
  it('keeps one active scope and one destroy listener per renderer', () => {
    const send = vi.fn();
    const once = vi.fn();
    const sender = {
      id: 7, send, once, isDestroyed: () => false,
    } as unknown as WebContents;
    const hub = new ElectronAgentTeamEventHub();

    hub.attach('scope-a', sender);
    hub.attach('scope-b', sender);
    hub.emitTeam('scope-a', null);
    hub.emitTeam('scope-b', null);

    expect(once).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith('ai:agent-team:event', { scopeId: 'scope-b', team: null });
  });
});
