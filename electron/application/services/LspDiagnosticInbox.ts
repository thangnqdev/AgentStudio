import type {
  LspDiagnostic,
  LspDiagnosticDelivery,
  LspDiagnosticFile,
} from '../../domain/entities/lspDiagnostic.js';
import type { ILspDiagnosticSink } from '../../domain/ports/ILspDiagnosticSink.js';

export const MAX_LSP_DIAGNOSTICS_PER_FILE = 10;
export const MAX_LSP_DIAGNOSTICS_TOTAL = 30;
export const MAX_LSP_DELIVERED_FILES = 500;

type PendingDiagnostics = { serverName: string; files: LspDiagnosticFile[] };
type GroupedFile = LspDiagnosticFile & { seen: Set<string> };

const SEVERITY_ORDER: Record<LspDiagnostic['severity'], number> = {
  Error: 1,
  Warning: 2,
  Info: 3,
  Hint: 4,
};

export class LspDiagnosticInbox implements ILspDiagnosticSink {
  private pending: PendingDiagnostics[] = [];
  private readonly deliveredByUri = new Map<string, Set<string>>();

  publish(serverName: string, files: LspDiagnosticFile[]) {
    const nonEmpty = files.filter((file) => file.diagnostics.length > 0).map(cloneFile);
    if (!serverName.trim() || nonEmpty.length === 0) return;
    this.pending.push({ serverName, files: nonEmpty });
  }

  clearFile(fileUri: string) {
    this.deliveredByUri.delete(fileUri);
  }

  clearPending() {
    this.pending = [];
  }

  reset() {
    this.pending = [];
    this.deliveredByUri.clear();
  }

  pendingCount() {
    return this.pending.length;
  }

  drain(): LspDiagnosticDelivery | undefined {
    const pending = this.pending;
    this.pending = [];
    if (pending.length === 0) return undefined;

    const serverNames = [...new Set(pending.map((item) => item.serverName))];
    const grouped = this.deduplicate(pending.flatMap((item) => item.files));
    const files = this.limit(grouped);
    if (files.length === 0) return undefined;
    for (const file of files) this.remember(file);
    return { serverNames, files };
  }

  private deduplicate(files: LspDiagnosticFile[]) {
    const grouped = new Map<string, GroupedFile>();
    for (const file of files) {
      let target = grouped.get(file.uri);
      if (!target) {
        target = { uri: file.uri, filePath: file.filePath, diagnostics: [], seen: new Set() };
        grouped.set(file.uri, target);
      }
      const delivered = this.touch(file.uri);
      for (const diagnostic of file.diagnostics) {
        const key = diagnosticKey(diagnostic);
        if (target.seen.has(key) || delivered?.has(key)) continue;
        target.seen.add(key);
        target.diagnostics.push({ ...diagnostic, range: cloneRange(diagnostic.range) });
      }
    }
    return [...grouped.values()].filter((file) => file.diagnostics.length > 0);
  }

  private limit(files: GroupedFile[]) {
    const limited: LspDiagnosticFile[] = [];
    let total = 0;
    for (const file of files) {
      const remaining = MAX_LSP_DIAGNOSTICS_TOTAL - total;
      if (remaining <= 0) break;
      const diagnostics = file.diagnostics
        .sort((left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity])
        .slice(0, Math.min(MAX_LSP_DIAGNOSTICS_PER_FILE, remaining));
      if (diagnostics.length > 0) limited.push({ uri: file.uri, filePath: file.filePath, diagnostics });
      total += diagnostics.length;
    }
    return limited;
  }

  private touch(uri: string) {
    const delivered = this.deliveredByUri.get(uri);
    if (!delivered) return undefined;
    this.deliveredByUri.delete(uri);
    this.deliveredByUri.set(uri, delivered);
    return delivered;
  }

  private remember(file: LspDiagnosticFile) {
    const delivered = this.touch(file.uri) ?? new Set<string>();
    for (const diagnostic of file.diagnostics) delivered.add(diagnosticKey(diagnostic));
    this.deliveredByUri.set(file.uri, delivered);
    while (this.deliveredByUri.size > MAX_LSP_DELIVERED_FILES) {
      const oldest = this.deliveredByUri.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.deliveredByUri.delete(oldest);
    }
  }
}

function diagnosticKey(diagnostic: LspDiagnostic) {
  const { start, end } = diagnostic.range;
  return JSON.stringify([
    diagnostic.message, diagnostic.severity,
    start.line, start.character, end.line, end.character,
    diagnostic.source ?? null, diagnostic.code ?? null,
  ]);
}

function cloneFile(file: LspDiagnosticFile): LspDiagnosticFile {
  return {
    uri: file.uri,
    filePath: file.filePath,
    diagnostics: file.diagnostics.map((diagnostic) => ({ ...diagnostic, range: cloneRange(diagnostic.range) })),
  };
}

function cloneRange(range: LspDiagnostic['range']) {
  return { start: { ...range.start }, end: { ...range.end } };
}
