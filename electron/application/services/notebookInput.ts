import {
  MAX_NOTEBOOK_BYTES,
  type NotebookCellType,
  type NotebookEditInput,
  type NotebookEditMode,
} from '../../domain/entities/notebook.js';

const MAX_NOTEBOOK_PATH_CHARACTERS = 4_096;
const MAX_CELL_ID_CHARACTERS = 200;

export function parseNotebookEditInput(args: Record<string, unknown>): NotebookEditInput {
  const notebookPath = requiredString(args.notebook_path, 'notebook_path', MAX_NOTEBOOK_PATH_CHARACTERS);
  if (!notebookPath.toLowerCase().endsWith('.ipynb')) throw new Error('NotebookEdit requires a .ipynb file.');
  const newSource = requiredString(args.new_source, 'new_source', MAX_NOTEBOOK_BYTES, true);
  const cellId = optionalString(args.cell_id, 'cell_id', MAX_CELL_ID_CHARACTERS);
  const cellType = optionalEnum(args.cell_type, ['code', 'markdown'] as const, 'cell_type');
  const editMode = optionalEnum(args.edit_mode, ['replace', 'insert', 'delete'] as const, 'edit_mode') ?? 'replace';
  if (editMode === 'insert' && !cellType) throw new Error('cell_type is required when edit_mode is insert.');
  if (editMode !== 'insert' && !cellId) throw new Error('cell_id is required when replacing or deleting a cell.');
  return {
    notebookPath,
    newSource,
    editMode: editMode as NotebookEditMode,
    ...(cellId ? { cellId } : {}),
    ...(cellType ? { cellType: cellType as NotebookCellType } : {}),
  };
}

export function isNotebookRead(args: Record<string, unknown>) {
  return typeof args.path === 'string' && args.path.trim().toLowerCase().endsWith('.ipynb');
}

function requiredString(value: unknown, field: string, max: number, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0') || (!allowEmpty && !value.trim())) {
    throw new Error(`NotebookEdit property "${field}" is invalid.`);
  }
  return field === 'notebook_path' ? value.trim() : value;
}

function optionalString(value: unknown, field: string, max: number) {
  if (value === undefined) return undefined;
  return requiredString(value, field, max);
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`NotebookEdit property "${field}" is invalid.`);
  return value as T;
}
