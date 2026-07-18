import { describe, expect, it } from 'vitest';
import type { NotebookDocument } from '../../domain/entities/notebook.js';
import { mutateNotebook } from './notebookMutation.js';

describe('mutateNotebook', () => {
  it('replaces by synthetic index and clears stale code execution output', () => {
    const notebook = document();
    const result = mutateNotebook(notebook, {
      notebookPath: 'a.ipynb', cellId: 'cell-0', newSource: 'print(2)', editMode: 'replace',
    }, () => 'unused');
    expect(notebook.cells[0]).toMatchObject({ source: 'print(2)', execution_count: null, outputs: [] });
    expect(result).toMatchObject({ cellId: 'code-id', editMode: 'replace', language: 'typescript' });
  });

  it('inserts after a real ID and generates a cell ID for notebook format 4.5', () => {
    const notebook = document();
    const result = mutateNotebook(notebook, {
      notebookPath: 'a.ipynb', cellId: 'code-id', newSource: '# Note', cellType: 'markdown', editMode: 'insert',
    }, () => 'new-id');
    expect(notebook.cells[1]).toEqual({ cell_type: 'markdown', id: 'new-id', source: '# Note', metadata: {} });
    expect(result.cellId).toBe('new-id');
  });

  it('deletes the resolved cell without touching its neighbor', () => {
    const notebook = document();
    mutateNotebook(notebook, { notebookPath: 'a.ipynb', cellId: 'code-id', newSource: '', editMode: 'delete' }, () => 'unused');
    expect(notebook.cells).toHaveLength(1);
    expect(notebook.cells[0]?.cell_type).toBe('markdown');
  });
});

function document(): NotebookDocument {
  return {
    nbformat: 4, nbformat_minor: 5, metadata: { language_info: { name: 'typescript' } },
    cells: [
      { cell_type: 'code', id: 'code-id', source: 'print(1)', metadata: {}, execution_count: 7, outputs: [{ output_type: 'stream', text: 'old' }] },
      { cell_type: 'markdown', source: '# Existing', metadata: {} },
    ],
  };
}
