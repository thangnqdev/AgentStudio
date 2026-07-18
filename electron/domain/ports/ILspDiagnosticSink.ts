import type { LspDiagnosticFile } from '../entities/lspDiagnostic.js';

export interface ILspDiagnosticSink {
  publish(serverName: string, files: LspDiagnosticFile[]): void;
  clearFile(fileUri: string): void;
}
