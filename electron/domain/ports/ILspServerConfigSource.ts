import type { LspServerConfiguration } from '../entities/lspServer.js';

export interface ILspServerConfigSource {
  list(workspaceRoot: string): Promise<LspServerConfiguration[]>;
}
