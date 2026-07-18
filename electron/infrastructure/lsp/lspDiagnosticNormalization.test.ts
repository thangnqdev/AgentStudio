import { describe, expect, it } from 'vitest';
import { normalizePublishedDiagnostics } from './lspDiagnosticNormalization.js';

describe('normalizePublishedDiagnostics', () => {
  it('normalizes file URIs, severity, codes, and valid ranges', () => {
    const result = normalizePublishedDiagnostics({
      uri: 'file:///workspace/a%20file.ts',
      diagnostics: [
        { message: 'warning', severity: 2, code: 123, source: 'ts', range: range(1, 2) },
        { message: 'info', severity: 3, range: range(2, 3) },
        { message: 'hint', severity: 4, range: range(3, 4) },
        { message: 'default', severity: 99, range: range(4, 5) },
      ],
    }, '/workspace');

    expect(result[0]).toMatchObject({ uri: 'file:///workspace/a%20file.ts', filePath: 'a file.ts' });
    expect(result[0]?.diagnostics.map((item) => item.severity)).toEqual(['Warning', 'Info', 'Hint', 'Error']);
    expect(result[0]?.diagnostics[0]).toMatchObject({ code: '123', source: 'ts' });
  });

  it('rejects malformed notifications and malformed diagnostic entries', () => {
    expect(normalizePublishedDiagnostics(null, '/workspace')).toEqual([]);
    expect(normalizePublishedDiagnostics({ uri: 'file:///x.ts', diagnostics: [{ message: 'bad' }] }, '/workspace')).toEqual([]);
    expect(normalizePublishedDiagnostics({ uri: 'file:///x.ts', diagnostics: [{ message: 'bad', range: range(-1, 0) }] }, '/workspace')).toEqual([]);
  });
});

function range(line: number, character: number) {
  return { start: { line, character }, end: { line, character: character + 1 } };
}
