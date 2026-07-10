import { KnowledgeBaseUseCase } from './application/usecases/KnowledgeBaseUseCase.js';
import { JsonKnowledgeRepository } from './infrastructure/knowledge/JsonKnowledgeRepository.js';
import { OpenAIEmbeddingClient } from './infrastructure/knowledge/OpenAIEmbeddingClient.js';
import { SettingsKnowledgeConfigProvider } from './infrastructure/knowledge/SettingsKnowledgeConfigProvider.js';
import { Utf8KnowledgeSourceReader } from './infrastructure/knowledge/Utf8KnowledgeSourceReader.js';
import { WorkspaceKnowledgeSourceScanner } from './infrastructure/knowledge/WorkspaceKnowledgeSourceScanner.js';
import { WorkspaceKnowledgeWatcher } from './infrastructure/knowledge/WorkspaceKnowledgeWatcher.js';
import { KnowledgeIndexQueue } from './application/services/knowledgeIndexQueue.js';

export const knowledgeBaseUseCase = new KnowledgeBaseUseCase(
  new JsonKnowledgeRepository(),
  new Utf8KnowledgeSourceReader(),
  new OpenAIEmbeddingClient(),
  new SettingsKnowledgeConfigProvider(),
);

const workspaceSourceScanner = new WorkspaceKnowledgeSourceScanner();
const workspaceKnowledgeWatcher = new WorkspaceKnowledgeWatcher();
const knowledgeIndexQueue = new KnowledgeIndexQueue();

export function importKnowledgeFiles(workspacePath: string, sourcePaths: string[]) {
  return knowledgeIndexQueue.enqueue(() => knowledgeBaseUseCase.importSelectedFiles(workspacePath, sourcePaths));
}

export function removeKnowledgeDocument(workspacePath: string, documentId: string) {
  return knowledgeIndexQueue.enqueue(() => knowledgeBaseUseCase.remove(workspacePath, documentId));
}

export function removeKnowledgeSourcePaths(workspacePath: string, sourcePaths: string[]) {
  return knowledgeIndexQueue.enqueue(() => knowledgeBaseUseCase.removeBySourcePaths(workspacePath, sourcePaths));
}

export async function syncWorkspaceKnowledge(workspacePath: string) {
  const scan = await workspaceSourceScanner.scan(workspacePath);
  const result = await importKnowledgeFiles(workspacePath, scan.sourcePaths);
  await workspaceKnowledgeWatcher.start(workspacePath, {
    onChanged: async (paths) => { await importKnowledgeFiles(workspacePath, paths); },
    onDeleted: async (paths) => { await removeKnowledgeSourcePaths(workspacePath, paths); },
  });
  return { ...result, scanned: scan.sourcePaths.length, truncated: scan.truncated, watching: true };
}

export async function stopWorkspaceKnowledgeSync() {
  await workspaceKnowledgeWatcher.stop();
  return { watching: false };
}

export function isWorkspaceKnowledgeSyncing(workspacePath: string) {
  return workspaceKnowledgeWatcher.isWatching(workspacePath);
}
