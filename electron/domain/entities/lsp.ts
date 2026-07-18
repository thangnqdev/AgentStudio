import type { AgentToolDefinition } from './tool.js';

export const LSP_TOOL_NAME = 'LSP';
export const MAX_LSP_FILE_BYTES = 10_000_000;

export const LSP_OPERATIONS = [
  'goToDefinition',
  'findReferences',
  'hover',
  'documentSymbol',
  'workspaceSymbol',
  'goToImplementation',
  'prepareCallHierarchy',
  'incomingCalls',
  'outgoingCalls',
] as const;

export type LspOperation = typeof LSP_OPERATIONS[number];

export type LspToolInput = {
  operation: LspOperation;
  filePath: string;
  line: number;
  character: number;
};

export type LspPosition = { line: number; character: number };
export type LspRange = { start: LspPosition; end: LspPosition };
export type LspLocation = { filePath: string; range: LspRange };

export type LspHover = {
  content: string;
  range?: LspRange;
};

export type LspDocumentSymbol = {
  name: string;
  kind: number;
  range: LspRange;
  detail?: string;
  children?: LspDocumentSymbol[];
};

export type LspWorkspaceSymbol = {
  name: string;
  kind: number;
  location: LspLocation;
  containerName?: string;
};

export type LspCallHierarchyItem = {
  name: string;
  kind: number;
  filePath: string;
  range: LspRange;
  detail?: string;
};

export type LspIncomingCall = {
  from: LspCallHierarchyItem;
  fromRanges: LspRange[];
};

export type LspOutgoingCall = {
  to: LspCallHierarchyItem;
  fromRanges: LspRange[];
};

export type LspGatewayResult =
  | { kind: 'locations'; locations: LspLocation[] }
  | { kind: 'hover'; hover: LspHover | null }
  | { kind: 'documentSymbols'; symbols: LspDocumentSymbol[] }
  | { kind: 'workspaceSymbols'; symbols: LspWorkspaceSymbol[] }
  | { kind: 'callHierarchy'; items: LspCallHierarchyItem[] }
  | { kind: 'incomingCalls'; calls: LspIncomingCall[] }
  | { kind: 'outgoingCalls'; calls: LspOutgoingCall[] };

export type LspToolOutput = {
  operation: LspOperation;
  result: string;
  filePath: string;
  resultCount?: number;
  fileCount?: number;
};

const operationEnum = [...LSP_OPERATIONS];

export const LSP_TOOL_DEFINITION: AgentToolDefinition = {
  name: LSP_TOOL_NAME,
  description: [
    'Interact with configured Language Server Protocol servers for code intelligence.',
    'Supports definitions, references, hover, document/workspace symbols, implementations, and call hierarchy.',
    'All positions use 1-based line and character numbers as shown in editors.',
  ].join(' '),
  risk: 'read',
  readOnly: true,
  concurrencySafe: true,
  deferLoading: true,
  searchHint: 'code intelligence definitions references symbols hover implementation call hierarchy',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      operation: { type: 'string', enum: operationEnum, description: 'The LSP operation to perform.' },
      filePath: { type: 'string', description: 'Absolute or workspace-relative file path.' },
      line: { type: 'integer', minimum: 1, description: '1-based editor line number.' },
      character: { type: 'integer', minimum: 1, description: '1-based editor character offset.' },
    },
    required: ['operation', 'filePath', 'line', 'character'],
  },
};
