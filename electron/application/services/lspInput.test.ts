import { describe, expect, it } from 'vitest';
import { parseLspInput } from './lspInput.js';

describe('parseLspInput', () => {
  it('accepts every reference operation with 1-based positions', () => {
    for (const operation of [
      'goToDefinition', 'findReferences', 'hover', 'documentSymbol', 'workspaceSymbol',
      'goToImplementation', 'prepareCallHierarchy', 'incomingCalls', 'outgoingCalls',
    ]) {
      expect(parseLspInput({ operation, filePath: 'src/main.ts', line: 1, character: 2 })).toEqual({
        operation, filePath: 'src/main.ts', line: 1, character: 2,
      });
    }
  });

  it('rejects unknown properties and non-positive or fractional positions', () => {
    expect(() => parseLspInput({ operation: 'hover', filePath: 'a.ts', line: 1, character: 1, extra: true }))
      .toThrow('unknown property "extra"');
    expect(() => parseLspInput({ operation: 'hover', filePath: 'a.ts', line: 0, character: 1 }))
      .toThrow('line must be a positive integer');
    expect(() => parseLspInput({ operation: 'hover', filePath: 'a.ts', line: 1, character: 1.5 }))
      .toThrow('character must be a positive integer');
  });
});
