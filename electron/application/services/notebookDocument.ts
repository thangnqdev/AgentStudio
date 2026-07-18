import type { NotebookCell, NotebookDocument } from '../../domain/entities/notebook.js';

export function parseNotebookDocument(content: string): NotebookDocument {
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new Error('Notebook is not valid JSON.'); }
  if (!isObject(parsed) || !Array.isArray(parsed.cells) || !isObject(parsed.metadata)
    || !Number.isInteger(parsed.nbformat) || !Number.isInteger(parsed.nbformat_minor)) {
    throw new Error('Notebook has an invalid document structure.');
  }
  for (const [index, rawCell] of parsed.cells.entries()) assertCell(rawCell, index);
  return parsed as NotebookDocument;
}

export function notebookLanguage(notebook: NotebookDocument) {
  return notebook.metadata.language_info?.name || notebook.metadata.kernelspec?.language || 'python';
}

export function resolveNotebookCell(notebook: NotebookDocument, cellId: string) {
  const byId = notebook.cells.findIndex((cell) => cell.id === cellId);
  if (byId >= 0) return byId;
  const match = /^cell-(\d+)$/.exec(cellId);
  if (!match) throw new Error(`Cell with ID "${cellId}" not found in notebook.`);
  const index = Number(match[1]);
  if (!notebook.cells[index]) throw new Error(`Cell with index ${index} does not exist in notebook.`);
  return index;
}

export function notebookSupportsCellIds(notebook: NotebookDocument) {
  return notebook.nbformat > 4 || (notebook.nbformat === 4 && notebook.nbformat_minor >= 5);
}

export function notebookCellSource(cell: NotebookCell) {
  return Array.isArray(cell.source) ? cell.source.join('') : cell.source;
}

function assertCell(value: unknown, index: number): asserts value is NotebookCell {
  if (!isObject(value) || (value.cell_type !== 'code' && value.cell_type !== 'markdown')
    || !isObject(value.metadata) || !validSource(value.source)
    || (value.id !== undefined && typeof value.id !== 'string')) {
    throw new Error(`Notebook cell ${index} has an invalid structure.`);
  }
}

function validSource(value: unknown) {
  return typeof value === 'string' || (Array.isArray(value) && value.every((part) => typeof part === 'string'));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
