import type { AppUpdateSnapshot } from '../../../src/domain/entities/appUpdate.js';
import type { IAppUpdater } from '../../domain/ports/IAppUpdater.js';

export class ManageAppUpdate {
  private readonly appUpdater: IAppUpdater;

  constructor(appUpdater: IAppUpdater) {
    this.appUpdater = appUpdater;
  }

  getStatus(): AppUpdateSnapshot {
    return this.appUpdater.getSnapshot();
  }

  checkForUpdates(): Promise<AppUpdateSnapshot> {
    return this.appUpdater.checkForUpdates();
  }

  downloadUpdate(): Promise<AppUpdateSnapshot> {
    return this.appUpdater.downloadUpdate();
  }

  quitAndInstall(): void {
    this.appUpdater.quitAndInstall();
  }

  subscribe(listener: (snapshot: AppUpdateSnapshot) => void): () => void {
    return this.appUpdater.subscribe(listener);
  }
}
