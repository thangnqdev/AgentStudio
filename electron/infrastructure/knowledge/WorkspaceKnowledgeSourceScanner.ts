import fs from 'node:fs/promises';
import path from 'node:path';
import { shouldIgnoreWorkspacePath, shouldIndexWorkspaceFile } from '../../application/services/knowledgeWorkspacePolicy.js';

const MAX_WORKSPACE_SOURCES = 2_000;

export class WorkspaceKnowledgeSourceScanner {
  async scan(workspacePath: string) {
    const workspaceRoot = path.resolve(workspacePath);
    const sources: string[] = [];
    await this.scanDirectory(workspaceRoot, workspaceRoot, sources);
    return { sourcePaths: sources, truncated: sources.length >= MAX_WORKSPACE_SOURCES };
  }

  private async scanDirectory(workspaceRoot: string, directoryPath: string, sources: string[]): Promise<void> {
    if (sources.length >= MAX_WORKSPACE_SOURCES) return;
    try {
      const entries = await fs.readdir(directoryPath, { encoding: 'utf8', withFileTypes: true });
      for (const entry of entries) {
        if (sources.length >= MAX_WORKSPACE_SOURCES || entry.isSymbolicLink()) continue;
        const entryPath = path.join(directoryPath, entry.name);
        const relativePath = path.relative(workspaceRoot, entryPath);
        if (entry.isDirectory()) {
          if (!shouldIgnoreWorkspacePath(relativePath)) await this.scanDirectory(workspaceRoot, entryPath, sources);
        } else if (entry.isFile() && shouldIndexWorkspaceFile(relativePath)) {
          sources.push(entryPath);
        }
      }
    } catch {
      return;
    }
  }
}
