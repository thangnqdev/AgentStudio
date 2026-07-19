import type { WorkspaceFileContent, WorkspaceFileEntry } from '../../domain/entities/workspaceFile.js';
import type { IWorkspaceFileBrowser } from '../../domain/ports/IWorkspaceFileBrowser.js';
import type { IWorkspaceRootSource } from '../../domain/ports/IWorkspaceRootSource.js';

export class BrowseWorkspaceUseCase {
  private readonly rootSource: IWorkspaceRootSource;
  private readonly browser: IWorkspaceFileBrowser;

  constructor(
    rootSource: IWorkspaceRootSource,
    browser: IWorkspaceFileBrowser,
  ) {
    this.rootSource = rootSource;
    this.browser = browser;
  }

  async list(relativeDirectory = '.'): Promise<WorkspaceFileEntry[]> {
    return this.browser.list(await this.rootSource.getWorkspaceRoot(), relativeDirectory || '.');
  }

  async read(relativePath: string): Promise<WorkspaceFileContent> {
    return this.browser.read(await this.rootSource.getWorkspaceRoot(), relativePath);
  }
}
