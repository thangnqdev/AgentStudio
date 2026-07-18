import fs from 'node:fs/promises';
import path from 'node:path';
import { LspDiagnosticInbox } from '../../application/services/LspDiagnosticInbox.js';
import { formatLspDiagnosticContext } from '../../application/services/lspDiagnosticContext.js';
import type { IAgentAmbientContextSource } from '../../domain/ports/IAgentAmbientContextSource.js';
import type { ILspDiagnosticSink } from '../../domain/ports/ILspDiagnosticSink.js';

const MAX_WORKSPACES = 20;

export class WorkspaceLspDiagnosticHub implements IAgentAmbientContextSource {
  private readonly inboxes = new Map<string, LspDiagnosticInbox>();

  sink(workspaceRoot: string): ILspDiagnosticSink { return this.inbox(workspaceRoot); }

  async drain(workspaceRoot: string) {
    const key = await canonicalRoot(workspaceRoot);
    const inbox = this.inboxes.get(key);
    return formatLspDiagnosticContext(inbox?.drain());
  }

  reset() {
    for (const inbox of this.inboxes.values()) inbox.reset();
    this.inboxes.clear();
  }

  private inbox(workspaceRoot: string) {
    const key = path.resolve(workspaceRoot);
    const existing = this.inboxes.get(key);
    if (existing) { this.inboxes.delete(key); this.inboxes.set(key, existing); return existing; }
    const inbox = new LspDiagnosticInbox();
    this.inboxes.set(key, inbox);
    while (this.inboxes.size > MAX_WORKSPACES) this.inboxes.delete(this.inboxes.keys().next().value!);
    return inbox;
  }
}

async function canonicalRoot(workspaceRoot: string) {
  try { return await fs.realpath(workspaceRoot); } catch { return path.resolve(workspaceRoot); }
}
