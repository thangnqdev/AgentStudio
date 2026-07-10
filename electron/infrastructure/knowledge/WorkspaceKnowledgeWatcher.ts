import chokidar, { type FSWatcher } from 'chokidar';
import path from 'node:path';
import { shouldIgnoreWorkspacePath, shouldIndexWorkspaceFile } from '../../application/services/knowledgeWorkspacePolicy.js';

type WatchHandlers = {
  onChanged(paths: string[]): Promise<void>;
  onDeleted(paths: string[]): Promise<void>;
};

const EVENT_BATCH_DELAY_MS = 750;

export class WorkspaceKnowledgeWatcher {
  private watcher: FSWatcher | null = null;
  private workspaceRoot = '';
  private changedPaths = new Set<string>();
  private deletedPaths = new Set<string>();
  private flushTimer: NodeJS.Timeout | null = null;

  async start(workspacePath: string, handlers: WatchHandlers) {
    await this.stop();
    this.workspaceRoot = path.resolve(workspacePath);
    this.watcher = chokidar.watch(this.workspaceRoot, {
      atomic: true,
      awaitWriteFinish: { stabilityThreshold: 750, pollInterval: 100 },
      followSymlinks: false,
      ignoreInitial: true,
      ignored: (watchedPath) => shouldIgnoreWorkspacePath(path.relative(this.workspaceRoot, watchedPath)),
    });
    this.watcher.on('add', (filePath) => this.queueChanged(filePath, handlers));
    this.watcher.on('change', (filePath) => this.queueChanged(filePath, handlers));
    this.watcher.on('unlink', (filePath) => this.queueDeleted(filePath, handlers));
    this.watcher.on('error', () => undefined);
  }

  async stop() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.changedPaths.clear();
    this.deletedPaths.clear();
    const watcher = this.watcher;
    this.watcher = null;
    this.workspaceRoot = '';
    if (watcher) await watcher.close();
  }

  isWatching(workspacePath: string) {
    return Boolean(this.watcher && this.workspaceRoot === path.resolve(workspacePath));
  }

  private queueChanged(filePath: string, handlers: WatchHandlers) {
    if (shouldIndexWorkspaceFile(path.relative(this.workspaceRoot, filePath))) {
      this.deletedPaths.delete(filePath);
      this.changedPaths.add(filePath);
      this.scheduleFlush(handlers);
    }
  }

  private queueDeleted(filePath: string, handlers: WatchHandlers) {
    if (shouldIndexWorkspaceFile(path.relative(this.workspaceRoot, filePath))) {
      this.changedPaths.delete(filePath);
      this.deletedPaths.add(filePath);
      this.scheduleFlush(handlers);
    }
  }

  private scheduleFlush(handlers: WatchHandlers) {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const changedPaths = [...this.changedPaths];
      const deletedPaths = [...this.deletedPaths];
      this.changedPaths.clear();
      this.deletedPaths.clear();
      void handlers.onDeleted(deletedPaths).then(() => handlers.onChanged(changedPaths)).catch(() => undefined);
    }, EVENT_BATCH_DELAY_MS);
  }
}
