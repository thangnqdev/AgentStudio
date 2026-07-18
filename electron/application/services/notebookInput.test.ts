import { describe, expect, it } from 'vitest';
import { parseNotebookEditInput } from './notebookInput.js';

describe('parseNotebookEditInput', () => {
  it('normalizes the reference defaults and conditional fields', () => {
    expect(parseNotebookEditInput({ notebook_path: 'analysis.ipynb', cell_id: 'cell-0', new_source: 'print(1)' }))
      .toEqual({ notebookPath: 'analysis.ipynb', cellId: 'cell-0', newSource: 'print(1)', editMode: 'replace' });
    expect(parseNotebookEditInput({ notebook_path: 'analysis.ipynb', new_source: '# Intro', edit_mode: 'insert', cell_type: 'markdown' }))
      .toEqual({ notebookPath: 'analysis.ipynb', newSource: '# Intro', editMode: 'insert', cellType: 'markdown' });
  });

  it('rejects invalid extensions, missing cell IDs and missing insert cell types', () => {
    expect(() => parseNotebookEditInput({ notebook_path: 'a.txt', cell_id: 'x', new_source: 'x' })).toThrow('.ipynb');
    expect(() => parseNotebookEditInput({ notebook_path: 'a.ipynb', new_source: 'x' })).toThrow('cell_id');
    expect(() => parseNotebookEditInput({ notebook_path: 'a.ipynb', new_source: 'x', edit_mode: 'insert' })).toThrow('cell_type');
  });
});
