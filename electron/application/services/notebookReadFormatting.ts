import { MAX_NOTEBOOK_RESULT_CHARACTERS, type NotebookCell, type NotebookDocument } from '../../domain/entities/notebook.js';
import { notebookCellSource, notebookLanguage } from './notebookDocument.js';

const MAX_CELL_OUTPUT_CHARACTERS = 10_000;

export function formatNotebookRead(notebook: NotebookDocument) {
  const language = notebookLanguage(notebook);
  const sections: string[] = [];
  let length = 0;
  for (const [index, cell] of notebook.cells.entries()) {
    const section = formatCell(cell, index, language);
    if (length + section.length > MAX_NOTEBOOK_RESULT_CHARACTERS) {
      sections.push('[Notebook output truncated. Read or search the raw .ipynb file in smaller targeted steps.]');
      break;
    }
    sections.push(section); length += section.length + 1;
  }
  return sections.join('\n');
}

function formatCell(cell: NotebookCell, index: number, language: string) {
  const id = cell.id ?? `cell-${index}`;
  const metadata = [
    cell.cell_type === 'markdown' ? '<cell_type>markdown</cell_type>' : '',
    cell.cell_type === 'code' && language !== 'python' ? `<language>${escapeXml(language)}</language>` : '',
  ].join('');
  const outputs = cell.cell_type === 'code' ? formatOutputs(cell.outputs) : '';
  return `<cell id="${escapeXml(id)}">${metadata}${notebookCellSource(cell)}${outputs}</cell id="${escapeXml(id)}">`;
}

function formatOutputs(outputs: unknown[] | undefined) {
  if (!outputs?.length) return '';
  const rendered = outputs.map(outputText).filter(Boolean).join('\n');
  if (!rendered) return '';
  const bounded = rendered.length <= MAX_CELL_OUTPUT_CHARACTERS
    ? rendered
    : `${rendered.slice(0, MAX_CELL_OUTPUT_CHARACTERS)}\n[Cell outputs truncated.]`;
  return `\n<outputs>${bounded}</outputs>`;
}

function outputText(value: unknown) {
  if (!isObject(value)) return '';
  if (value.output_type === 'stream') return joinText(value.text);
  if (value.output_type === 'error') {
    const traceback = Array.isArray(value.traceback) ? value.traceback.filter((part): part is string => typeof part === 'string').join('\n') : '';
    return `${string(value.ename)}: ${string(value.evalue)}${traceback ? `\n${traceback}` : ''}`;
  }
  if (value.output_type === 'execute_result' || value.output_type === 'display_data') {
    return isObject(value.data) ? joinText(value.data['text/plain']) : '';
  }
  return '';
}

function joinText(value: unknown) {
  return typeof value === 'string' ? value : Array.isArray(value) ? value.filter((part): part is string => typeof part === 'string').join('') : '';
}
function string(value: unknown) { return typeof value === 'string' ? value : ''; }
function escapeXml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
