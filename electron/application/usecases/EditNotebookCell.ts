import type { PermissionMode } from '../../domain/entities/agent.js';
import type { NotebookEditInput } from '../../domain/entities/notebook.js';
import type { INotebookDocumentGateway } from '../../domain/ports/INotebookDocumentGateway.js';
import { parseNotebookDocument } from '../services/notebookDocument.js';
import { mutateNotebook } from '../services/notebookMutation.js';

export class EditNotebookCell {
  private readonly gateway: INotebookDocumentGateway;
  private readonly createCellId: () => string;

  constructor(
    gateway: INotebookDocumentGateway,
    createCellId: () => string = defaultCellId,
  ) { this.gateway = gateway; this.createCellId = createCellId; }

  async execute(input: NotebookEditInput, workspaceRoot: string, permissionMode: PermissionMode) {
    if (permissionMode === 'read-only') throw new Error('NotebookEdit is blocked in read-only mode.');
    const snapshot = await this.gateway.read({ notebookPath: input.notebookPath, workspaceRoot, permissionMode }, false);
    if (snapshot.observedContent === undefined) throw new Error('Notebook has not been read yet. Read it first before editing.');
    if (snapshot.observedContent !== snapshot.content) throw new Error('Notebook has been modified since it was read. Read it again before editing.');
    const notebook = parseNotebookDocument(snapshot.content);
    const result = mutateNotebook(notebook, input, this.createCellId);
    const updatedContent = JSON.stringify(notebook, null, 1);
    await this.gateway.write(snapshot, updatedContent);
    return result;
  }
}

function defaultCellId() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 13);
}
