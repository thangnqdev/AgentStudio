import { describe, expect, it } from 'vitest';
import type { LspDiagnostic, LspDiagnosticSeverity } from '../../domain/entities/lspDiagnostic.js';
import {
  LspDiagnosticInbox,
  MAX_LSP_DELIVERED_FILES,
  MAX_LSP_DIAGNOSTICS_PER_FILE,
  MAX_LSP_DIAGNOSTICS_TOTAL,
} from './LspDiagnosticInbox.js';

describe('LspDiagnosticInbox', () => {
  it('deduplicates and prioritizes diagnostics within per-file and total limits', () => {
    const inbox = new LspDiagnosticInbox();
    const first = file('file:///a.ts', Array.from({ length: 12 }, (_, index) => diagnostic(index, index === 11 ? 'Error' : 'Hint')));
    first.diagnostics.push(first.diagnostics[0]!);
    inbox.publish('typescript', [first, file('file:///b.ts', diagnostics(15, 'Warning'))]);
    inbox.publish('eslint', [file('file:///c.ts', diagnostics(15, 'Info'))]);

    const delivery = inbox.drain();
    expect(delivery?.serverNames).toEqual(['typescript', 'eslint']);
    expect(delivery?.files.every((item) => item.diagnostics.length <= MAX_LSP_DIAGNOSTICS_PER_FILE)).toBe(true);
    expect(delivery?.files.flatMap((item) => item.diagnostics)).toHaveLength(MAX_LSP_DIAGNOSTICS_TOTAL);
    expect(delivery?.files[0]?.diagnostics[0]?.severity).toBe('Error');
    expect(inbox.pendingCount()).toBe(0);
  });

  it('deduplicates across turns and resets a file when it changes', () => {
    const inbox = new LspDiagnosticInbox();
    const value = file('file:///src/main.ts', [diagnostic(1, 'Error')]);
    inbox.publish('typescript', [value]);
    expect(inbox.drain()?.files).toHaveLength(1);
    inbox.publish('typescript', [value]);
    expect(inbox.drain()).toBeUndefined();

    inbox.clearFile(value.uri);
    inbox.publish('typescript', [value]);
    expect(inbox.drain()?.files).toHaveLength(1);
  });

  it('evicts the least recently used delivered file after 500 files', () => {
    const inbox = new LspDiagnosticInbox();
    for (let index = 0; index <= MAX_LSP_DELIVERED_FILES; index += 1) {
      inbox.publish('server', [file(`file:///file-${index}.ts`, [diagnostic(0, 'Error')])]);
      expect(inbox.drain()).toBeDefined();
    }
    inbox.publish('server', [file('file:///file-0.ts', [diagnostic(0, 'Error')])]);
    expect(inbox.drain()).toBeDefined();
  });
});

function file(uri: string, values: LspDiagnostic[]) {
  return { uri, filePath: uri.replace('file:///', ''), diagnostics: values };
}

function diagnostics(count: number, severity: LspDiagnosticSeverity) {
  return Array.from({ length: count }, (_, index) => diagnostic(index, severity));
}

function diagnostic(index: number, severity: LspDiagnosticSeverity): LspDiagnostic {
  return {
    message: `Diagnostic ${index}`,
    severity,
    range: { start: { line: index, character: 0 }, end: { line: index, character: 1 } },
  };
}
