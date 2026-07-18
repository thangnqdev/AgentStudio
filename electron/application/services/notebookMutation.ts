import type {
  NotebookCell,
  NotebookCellType,
  NotebookDocument,
  NotebookEditInput,
  NotebookEditResult,
} from '../../domain/entities/notebook.js';
import { notebookLanguage, notebookSupportsCellIds, resolveNotebookCell } from './notebookDocument.js';

export function mutateNotebook(
  notebook: NotebookDocument,
  input: NotebookEditInput,
  createCellId: () => string,
): NotebookEditResult {
  const language = notebookLanguage(notebook);
  if (input.editMode === 'insert') return insertCell(notebook, input, language, createCellId);
  const index = resolveNotebookCell(notebook, input.cellId!);
  const target = notebook.cells[index]!;
  if (input.editMode === 'delete') {
    notebook.cells.splice(index, 1);
    return result(input, target.cell_type, language, target.id ?? input.cellId);
  }
  target.source = input.newSource;
  if (target.cell_type === 'code') { target.execution_count = null; target.outputs = []; }
  if (input.cellType) target.cell_type = input.cellType;
  return result(input, target.cell_type, language, target.id ?? input.cellId);
}

function insertCell(
  notebook: NotebookDocument,
  input: NotebookEditInput,
  language: string,
  createCellId: () => string,
) {
  const index = input.cellId ? resolveNotebookCell(notebook, input.cellId) + 1 : 0;
  const cellType = input.cellType!;
  const cellId = notebookSupportsCellIds(notebook) ? createCellId() : undefined;
  const cell: NotebookCell = cellType === 'code'
    ? { cell_type: 'code', ...(cellId ? { id: cellId } : {}), source: input.newSource, metadata: {}, execution_count: null, outputs: [] }
    : { cell_type: 'markdown', ...(cellId ? { id: cellId } : {}), source: input.newSource, metadata: {} };
  notebook.cells.splice(index, 0, cell);
  return result(input, cellType, language, cellId);
}

function result(input: NotebookEditInput, cellType: NotebookCellType, language: string, cellId?: string): NotebookEditResult {
  return {
    newSource: input.newSource,
    editMode: input.editMode,
    cellType,
    language,
    ...(cellId ? { cellId } : {}),
  };
}
