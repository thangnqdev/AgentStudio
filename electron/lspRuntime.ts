import { LspToolPlatform } from './application/services/LspToolPlatform.js';
import type { IToolCatalog } from './domain/ports/IToolCatalog.js';
import type { IToolExecutor } from './domain/ports/IToolExecutor.js';
import { TrustedPluginLspConfigSource } from './infrastructure/lsp/TrustedPluginLspConfigSource.js';
import { WorkspaceLspServerRegistry } from './infrastructure/lsp/WorkspaceLspServerRegistry.js';
import { WorkspaceLspDiagnosticHub } from './infrastructure/lsp/WorkspaceLspDiagnosticHub.js';
import { GitIgnoreFilteringLspGateway } from './application/services/GitIgnoreFilteringLspGateway.js';
import { GitCheckIgnoreFilter } from './infrastructure/git/GitCheckIgnoreFilter.js';
import { pluginManager } from './pluginRuntime.js';

export const lspDiagnosticHub = new WorkspaceLspDiagnosticHub();
export const lspGateway = new WorkspaceLspServerRegistry(
  new TrustedPluginLspConfigSource(pluginManager),
  (workspaceRoot) => lspDiagnosticHub.sink(workspaceRoot),
);
const visibleLspGateway = new GitIgnoreFilteringLspGateway(lspGateway, new GitCheckIgnoreFilter());

export function createLspToolPlatform(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor) {
  return new LspToolPlatform(baseCatalog, baseExecutor, visibleLspGateway);
}
