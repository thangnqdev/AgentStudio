import type { PermissionMode } from '../../domain/entities/agent.js';
import type { INotebookDocumentGateway } from '../../domain/ports/INotebookDocumentGateway.js';
import { parseNotebookDocument } from '../services/notebookDocument.js';
import { formatNotebookRead } from '../services/notebookReadFormatting.js';

export class ReadNotebook {
  private readonly gateway: INotebookDocumentGateway;

  constructor(gateway: INotebookDocumentGateway) { this.gateway = gateway; }

  async execute(notebookPath: string, workspaceRoot: string, permissionMode: PermissionMode) {
    const snapshot = await this.gateway.read({ notebookPath, workspaceRoot, permissionMode }, true);
    return formatNotebookRead(parseNotebookDocument(snapshot.content));
  }
}
