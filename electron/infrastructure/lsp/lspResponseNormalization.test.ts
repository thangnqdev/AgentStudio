import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalizeLspResponse } from './lspResponseNormalization.js';

const workspace = path.resolve('/workspace');
const range = { start: { line: 2, character: 3 }, end: { line: 2, character: 6 } };

describe('normalizeLspResponse', () => {
  it('normalizes LocationLink and percent-encoded file URIs', () => {
    const uri = pathToFileURL(path.join(workspace, 'src', 'file name.ts')).href;
    expect(normalizeLspResponse('goToDefinition', [{
      targetUri: uri,
      targetRange: { start: { line: 0, character: 0 }, end: { line: 9, character: 0 } },
      targetSelectionRange: range,
    }], workspace)).toEqual({
      kind: 'locations',
      locations: [{ filePath: 'src/file name.ts', range }],
    });
  });

  it('uses workspace-symbol formatting for flat document SymbolInformation responses', () => {
    const uri = pathToFileURL(path.join(workspace, 'src', 'main.ts')).href;
    expect(normalizeLspResponse('documentSymbol', [{
      name: 'main', kind: 12, containerName: 'module', location: { uri, range },
    }], workspace)).toEqual({
      kind: 'workspaceSymbols',
      symbols: [{ name: 'main', kind: 12, containerName: 'module', location: { filePath: 'src/main.ts', range } }],
    });
  });
});
