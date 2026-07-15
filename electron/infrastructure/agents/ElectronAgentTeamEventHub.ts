import type { WebContents } from 'electron';
import type { AgentTeamView } from '../../domain/entities/agentTeam.js';
import type { IAgentTeamEventSink } from '../../domain/ports/IAgentTeamEventSink.js';

export class ElectronAgentTeamEventHub implements IAgentTeamEventSink {
  private readonly senders = new Map<string, Map<number, WebContents>>();
  private readonly senderScopes = new Map<number, string>();
  private readonly destroySubscriptions = new Set<number>();

  attach(scopeId: string, sender: WebContents) {
    const previousScope = this.senderScopes.get(sender.id);
    if (previousScope && previousScope !== scopeId) {
      const previous = this.senders.get(previousScope);
      previous?.delete(sender.id);
      if (previous?.size === 0) this.senders.delete(previousScope);
    }
    const scoped = this.senders.get(scopeId) ?? new Map<number, WebContents>();
    if (scoped.has(sender.id)) return;
    scoped.set(sender.id, sender);
    this.senders.set(scopeId, scoped);
    this.senderScopes.set(sender.id, scopeId);
    if (!this.destroySubscriptions.has(sender.id)) {
      this.destroySubscriptions.add(sender.id);
      sender.once('destroyed', () => this.detach(sender.id));
    }
  }

  emitTeam(scopeId: string, team: AgentTeamView | null) {
    for (const sender of this.senders.get(scopeId)?.values() ?? []) {
      if (!sender.isDestroyed()) sender.send('ai:agent-team:event', { scopeId, team });
    }
  }

  private detach(senderId: number) {
    const scopeId = this.senderScopes.get(senderId);
    const scoped = scopeId ? this.senders.get(scopeId) : undefined;
    scoped?.delete(senderId);
    if (scopeId && scoped?.size === 0) this.senders.delete(scopeId);
    this.senderScopes.delete(senderId);
    this.destroySubscriptions.delete(senderId);
  }
}
