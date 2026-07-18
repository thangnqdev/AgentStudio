import type { LspRange } from './lsp.js';

export type LspDiagnosticSeverity = 'Error' | 'Warning' | 'Info' | 'Hint';

export type LspDiagnostic = {
  message: string;
  severity: LspDiagnosticSeverity;
  range: LspRange;
  source?: string;
  code?: string;
};

export type LspDiagnosticFile = {
  uri: string;
  filePath: string;
  diagnostics: LspDiagnostic[];
};

export type LspDiagnosticDelivery = {
  serverNames: string[];
  files: LspDiagnosticFile[];
};
