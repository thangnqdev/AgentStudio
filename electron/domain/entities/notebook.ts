import type { AgentToolDefinition } from './tool.js';

export const NOTEBOOK_EDIT_TOOL_NAME = 'NotebookEdit';
export const MAX_NOTEBOOK_BYTES = 10 * 1024 * 1024;
export const MAX_NOTEBOOK_RESULT_CHARACTERS = 100_000;

export type NotebookCellType = 'code' | 'markdown';
export type NotebookEditMode = 'replace' | 'insert' | 'delete';
export type NotebookCell = {
  cell_type: NotebookCellType;
  id?: string;
  source: string | string[];
  metadata: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: unknown[];
  [key: string]: unknown;
};
export type NotebookDocument = {
  cells: NotebookCell[];
  metadata: Record<string, unknown> & {
    language_info?: { name?: string };
    kernelspec?: { language?: string };
  };
  nbformat: number;
  nbformat_minor: number;
  [key: string]: unknown;
};
export type NotebookEditInput = {
  notebookPath: string;
  cellId?: string;
  newSource: string;
  cellType?: NotebookCellType;
  editMode: NotebookEditMode;
};
export type NotebookEditResult = {
  cellId?: string;
  cellType: NotebookCellType;
  editMode: NotebookEditMode;
  language: string;
  newSource: string;
};

export const NOTEBOOK_EDIT_TOOL_DEFINITION: AgentToolDefinition = {
  name: NOTEBOOK_EDIT_TOOL_NAME,
  description: [
    'Edit one Jupyter notebook cell after reading the notebook with read_file.',
    'Use edit_mode replace, insert, or delete. Insert occurs after cell_id, or at the beginning when cell_id is omitted.',
    'Use the real cell ID shown by read_file, or the synthetic cell-N ID.',
  ].join('\n'),
  risk: 'write',
  deferLoading: true,
  searchHint: 'edit Jupyter notebook cells ipynb',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      notebook_path: { type: 'string', description: 'Absolute or workspace-relative .ipynb path.' },
      cell_id: { type: 'string', description: 'Real cell ID or synthetic cell-N index.' },
      new_source: { type: 'string', description: 'New cell source. Required even for delete.' },
      cell_type: { type: 'string', enum: ['code', 'markdown'] },
      edit_mode: { type: 'string', enum: ['replace', 'insert', 'delete'] },
    },
    required: ['notebook_path', 'new_source'],
  },
};
