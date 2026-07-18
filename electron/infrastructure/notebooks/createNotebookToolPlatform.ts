import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import { NotebookToolPlatform } from '../../application/services/NotebookToolPlatform.js';
import { EditNotebookCell } from '../../application/usecases/EditNotebookCell.js';
import { ReadNotebook } from '../../application/usecases/ReadNotebook.js';
import { FileSystemNotebookDocumentGateway } from './FileSystemNotebookDocumentGateway.js';
import type { IWorkspaceFileChangeSink } from '../../domain/ports/IWorkspaceFileChangeSink.js';

export function createNotebookToolPlatform(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor, changes?: IWorkspaceFileChangeSink) {
  const gateway = new FileSystemNotebookDocumentGateway(changes);
  return new NotebookToolPlatform(baseCatalog, baseExecutor, new ReadNotebook(gateway), new EditNotebookCell(gateway));
}
