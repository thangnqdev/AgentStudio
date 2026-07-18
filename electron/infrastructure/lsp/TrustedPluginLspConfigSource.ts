import type { LspServerConfiguration } from '../../domain/entities/lspServer.js';
import type { ILspServerConfigSource } from '../../domain/ports/ILspServerConfigSource.js';

type TrustedPluginLspManager = {
  listLspServers(workspaceRoot: string): Promise<LspServerConfiguration[]>;
};

export class TrustedPluginLspConfigSource implements ILspServerConfigSource {
  private readonly plugins: TrustedPluginLspManager;

  constructor(plugins: TrustedPluginLspManager) { this.plugins = plugins; }

  list(workspaceRoot: string) { return this.plugins.listLspServers(workspaceRoot); }
}
