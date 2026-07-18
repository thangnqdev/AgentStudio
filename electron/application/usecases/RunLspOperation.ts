import type { LspToolInput, LspToolOutput } from '../../domain/entities/lsp.js';
import type { ILanguageServerGateway } from '../../domain/ports/ILanguageServerGateway.js';
import { formatLspResult } from '../services/lspResultFormatting.js';

export class RunLspOperation {
  private readonly gateway: ILanguageServerGateway;

  constructor(gateway: ILanguageServerGateway) {
    this.gateway = gateway;
  }

  async execute(input: LspToolInput, workspaceRoot: string, signal?: AbortSignal): Promise<LspToolOutput> {
    if (signal?.aborted) throw new Error('LSP operation cancelled.');
    const result = await this.gateway.execute(input, workspaceRoot, signal);
    if (!result) {
      return {
        operation: input.operation,
        result: `No LSP server available for file type: ${extensionOf(input.filePath)}`,
        filePath: input.filePath,
      };
    }
    return formatLspResult(input, result);
  }
}

function extensionOf(filePath: string) {
  const base = filePath.replaceAll('\\', '/').split('/').at(-1) || '';
  const index = base.lastIndexOf('.');
  return index > 0 ? base.slice(index) : '';
}
