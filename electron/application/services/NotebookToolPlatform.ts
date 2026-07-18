import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import { NOTEBOOK_EDIT_TOOL_DEFINITION, NOTEBOOK_EDIT_TOOL_NAME, type NotebookEditResult } from '../../domain/entities/notebook.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { EditNotebookCell } from '../usecases/EditNotebookCell.js';
import type { ReadNotebook } from '../usecases/ReadNotebook.js';
import { isNotebookRead, parseNotebookEditInput } from './notebookInput.js';

export class NotebookToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly reader: ReadNotebook;
  private readonly editor: EditNotebookCell;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    reader: ReadNotebook,
    editor: EditNotebookCell,
  ) {
    this.baseCatalog = baseCatalog; this.baseExecutor = baseExecutor;
    this.reader = reader; this.editor = editor;
  }

  async list(workspaceRoot: string) {
    const tools = (await this.baseCatalog.list(workspaceRoot)).map((tool) => tool.name === 'read_file'
      ? { ...tool, description: `${tool.description} Jupyter .ipynb files are rendered as addressable cells with outputs.` }
      : tool);
    return [...tools.filter((tool) => tool.name !== NOTEBOOK_EDIT_TOOL_NAME), NOTEBOOK_EDIT_TOOL_DEFINITION];
  }

  async execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal): Promise<ToolResult> {
    if (signal?.aborted) return { ok: false, output: 'Agent session stopped.' };
    try {
      if (toolName === 'read_file' && isNotebookRead(args)) {
        return { ok: true, output: await this.reader.execute(String(args.path), workspaceRoot, permissionMode) };
      }
      if (toolName === NOTEBOOK_EDIT_TOOL_NAME) {
        const result = await this.editor.execute(parseNotebookEditInput(args), workspaceRoot, permissionMode);
        return { ok: true, output: formatEditResult(result) };
      }
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Notebook operation failed.' };
    }
  }
}

function formatEditResult(result: NotebookEditResult) {
  const id = result.cellId ?? 'new cell';
  if (result.editMode === 'insert') return `Inserted cell ${id} with ${result.newSource}`;
  if (result.editMode === 'delete') return `Deleted cell ${id}`;
  return `Updated cell ${id} with ${result.newSource}`;
}
