import { describe, expect, it } from 'vitest';
import type { ILanguageServerGateway } from '../../domain/ports/ILanguageServerGateway.js';
import { RunLspOperation } from './RunLspOperation.js';

describe('RunLspOperation', () => {
  it('returns the reference-style unavailable result without treating it as execution failure', async () => {
    const gateway: ILanguageServerGateway = { isAvailable: async () => false, execute: async () => undefined };
    const output = await new RunLspOperation(gateway).execute({
      operation: 'hover', filePath: 'src/example.ts', line: 1, character: 1,
    }, '/workspace');
    expect(output).toEqual({ operation: 'hover', result: 'No LSP server available for file type: .ts', filePath: 'src/example.ts' });
  });
});
