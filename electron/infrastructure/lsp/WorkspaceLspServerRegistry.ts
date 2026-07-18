import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { LspGatewayResult, LspToolInput } from '../../domain/entities/lsp.js';
import type { ILanguageServerGateway } from '../../domain/ports/ILanguageServerGateway.js';
import type { ILspDiagnosticSink } from '../../domain/ports/ILspDiagnosticSink.js';
import type { ILspServerConfigSource } from '../../domain/ports/ILspServerConfigSource.js';
import type { IWorkspaceFileChangeSink } from '../../domain/ports/IWorkspaceFileChangeSink.js';
import { createStdioLspClient } from './StdioLspClient.js';
import { WorkspaceLspServerManager } from './WorkspaceLspServerManager.js';

type Entry = { fingerprint: string; manager: WorkspaceLspServerManager };

export class WorkspaceLspServerRegistry implements ILanguageServerGateway, IWorkspaceFileChangeSink {
  private readonly source: ILspServerConfigSource;
  private readonly diagnosticSink?: (workspaceRoot: string) => ILspDiagnosticSink;
  private readonly entries = new Map<string, Entry>();
  private readonly locks = new Map<string, Promise<Entry | undefined>>();

  constructor(source: ILspServerConfigSource, diagnosticSink?: (workspaceRoot: string) => ILspDiagnosticSink) {
    this.source = source;
    this.diagnosticSink = diagnosticSink;
  }

  async isAvailable(workspaceRoot: string) { return Boolean(await this.refresh(workspaceRoot)); }

  async execute(input: LspToolInput, workspaceRoot: string, signal?: AbortSignal): Promise<LspGatewayResult | undefined> {
    const root = await canonicalRoot(workspaceRoot);
    return (await this.refresh(root))?.manager.execute(input, root, signal);
  }

  async shutdownAll() {
    const managers = [...this.entries.values()].map((entry) => entry.manager);
    this.entries.clear();
    await Promise.allSettled(managers.map((manager) => manager.shutdown()));
  }

  async fileChanged(filePath: string, workspaceRoot: string) {
    const entry = await this.refresh(workspaceRoot);
    await entry?.manager.fileChanged(filePath);
  }

  private async refresh(workspaceRoot: string) {
    const root = await canonicalRoot(workspaceRoot);
    const pending = this.locks.get(root);
    if (pending) return pending;
    const operation = this.refreshLocked(root).finally(() => this.locks.delete(root));
    this.locks.set(root, operation);
    return operation;
  }

  private async refreshLocked(root: string) {
    const configurations = await this.source.list(root);
    const current = this.entries.get(root);
    if (!configurations.length) {
      this.entries.delete(root);
      if (current) await current.manager.shutdown();
      return undefined;
    }
    const fingerprint = createHash('sha256').update(JSON.stringify(configurations)).digest('hex');
    if (current?.fingerprint === fingerprint) return current;
    if (current) await current.manager.shutdown();
    const entry = {
      fingerprint,
      manager: new WorkspaceLspServerManager(root, configurations, createStdioLspClient, this.diagnosticSink?.(root)),
    };
    this.entries.set(root, entry);
    return entry;
  }
}

async function canonicalRoot(workspaceRoot: string) {
  try { return await fs.realpath(workspaceRoot); } catch { return path.resolve(workspaceRoot); }
}
