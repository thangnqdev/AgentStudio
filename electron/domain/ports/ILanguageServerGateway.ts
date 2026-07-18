import type { LspGatewayResult, LspToolInput } from '../entities/lsp.js';

export interface ILanguageServerGateway {
  isAvailable(workspaceRoot: string): Promise<boolean>;
  execute(
    input: LspToolInput,
    workspaceRoot: string,
    signal?: AbortSignal,
  ): Promise<LspGatewayResult | undefined>;
}
