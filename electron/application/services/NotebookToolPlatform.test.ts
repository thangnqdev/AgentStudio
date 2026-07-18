import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createNotebookToolPlatform } from '../../infrastructure/notebooks/createNotebookToolPlatform.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe('NotebookToolPlatform', () => {
  it('publishes the exact deferred NotebookEdit contract and notebook-aware read description', async () => {
    const readTool = { name: 'read_file', description: 'Read a file.', risk: 'read' as const, parameters: {} };
    const base = { list: async () => [readTool], execute: async () => ({ ok: false, output: 'unused' }) };
    const tools = await createNotebookToolPlatform(base, base).list('/workspace');
    expect(tools.find((tool) => tool.name === 'NotebookEdit')).toMatchObject({ risk: 'write', deferLoading: true });
    expect(tools.find((tool) => tool.name === 'read_file')?.description).toContain('addressable cells');
  });

  it('renders notebook cells, then edits a previously read code cell', async () => {
    const root = await temporaryDirectory();
    const target = path.join(root, 'analysis.ipynb');
    await fs.writeFile(target, JSON.stringify(notebook()));
    const base = { list: async () => [], execute: async () => ({ ok: false, output: 'base unused' }) };
    const platform = createNotebookToolPlatform(base, base);
    const read = await platform.execute('read_file', { path: 'analysis.ipynb' }, root, 'workspace-write');
    expect(read.output).toContain('<cell id="code-id">');
    expect(read.output).toContain('<outputs>old output</outputs>');

    const edited = await platform.execute('NotebookEdit', {
      notebook_path: 'analysis.ipynb', cell_id: 'code-id', new_source: 'print(2)', edit_mode: 'replace',
    }, root, 'workspace-write');
    expect(edited).toEqual({ ok: true, output: 'Updated cell code-id with print(2)' });
    const saved = JSON.parse(await fs.readFile(target, 'utf8'));
    expect(saved.cells[0]).toMatchObject({ source: 'print(2)', execution_count: null, outputs: [] });
  });

  it('requires a fresh notebook read and blocks edits in read-only mode', async () => {
    const root = await temporaryDirectory();
    await fs.writeFile(path.join(root, 'analysis.ipynb'), JSON.stringify(notebook()));
    const base = { list: async () => [], execute: async () => ({ ok: false, output: 'base unused' }) };
    const platform = createNotebookToolPlatform(base, base);
    const args = { notebook_path: 'analysis.ipynb', cell_id: 'code-id', new_source: 'print(2)' };
    expect((await platform.execute('NotebookEdit', args, root, 'workspace-write')).output).toContain('not been read');
    await platform.execute('read_file', { path: 'analysis.ipynb' }, root, 'read-only');
    expect((await platform.execute('NotebookEdit', args, root, 'read-only')).output).toContain('blocked in read-only');
  });

  it('does not share read observations across agent sessions', async () => {
    const root = await temporaryDirectory();
    await fs.writeFile(path.join(root, 'analysis.ipynb'), JSON.stringify(notebook()));
    const base = { list: async () => [], execute: async () => ({ ok: false, output: 'base unused' }) };
    const firstSession = createNotebookToolPlatform(base, base);
    const secondSession = createNotebookToolPlatform(base, base);
    await firstSession.execute('read_file', { path: 'analysis.ipynb' }, root, 'workspace-write');
    const edited = await secondSession.execute('NotebookEdit', {
      notebook_path: 'analysis.ipynb', cell_id: 'code-id', new_source: 'print(2)',
    }, root, 'workspace-write');
    expect(edited).toMatchObject({ ok: false });
    expect(edited.output).toContain('not been read');
  });
});

function notebook() {
  return { nbformat: 4, nbformat_minor: 5, metadata: { language_info: { name: 'python' } }, cells: [
    { cell_type: 'code', id: 'code-id', source: 'print(1)', metadata: {}, execution_count: 1, outputs: [{ output_type: 'stream', text: 'old output' }] },
  ] };
}
async function temporaryDirectory() { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-notebook-platform-')); roots.push(root); return root; }
