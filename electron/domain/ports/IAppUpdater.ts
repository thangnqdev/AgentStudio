import type { AppUpdateSnapshot } from '../../../src/domain/entities/appUpdate.js';

export interface IAppUpdater {
  getSnapshot(): AppUpdateSnapshot;
  checkForUpdates(): Promise<AppUpdateSnapshot>;
  downloadUpdate(): Promise<AppUpdateSnapshot>;
  quitAndInstall(): void;
  subscribe(listener: (snapshot: AppUpdateSnapshot) => void): () => void;
}
