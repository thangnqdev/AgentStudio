import { app } from 'electron';
import electronUpdater, { type ProgressInfo, type UpdateInfo } from 'electron-updater';

import type { AppUpdateSnapshot } from '../../src/domain/entities/appUpdate.js';
import type { IAppUpdater } from '../domain/ports/IAppUpdater.js';

const { autoUpdater } = electronUpdater;

export class ElectronAutoUpdater implements IAppUpdater {
  private snapshot: AppUpdateSnapshot = { status: 'idle' };
  private readonly listeners = new Set<(snapshot: AppUpdateSnapshot) => void>();

  constructor() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('checking-for-update', () => this.setSnapshot({ status: 'checking' }));
    autoUpdater.on('update-available', (info) => this.handleUpdateAvailable(info));
    autoUpdater.on('update-not-available', () => this.setSnapshot({ status: 'not-available' }));
    autoUpdater.on('download-progress', (progress) => this.handleDownloadProgress(progress));
    autoUpdater.on('update-downloaded', (info) => this.setSnapshot({ status: 'downloaded', version: info.version }));
    autoUpdater.on('error', (error) => this.setSnapshot({ status: 'error', message: error.message }));
  }

  getSnapshot(): AppUpdateSnapshot {
    return this.snapshot;
  }

  async checkForUpdates(): Promise<AppUpdateSnapshot> {
    if (!app.isPackaged) {
      this.setSnapshot({ status: 'unsupported', message: 'Chỉ kiểm tra cập nhật trong bản đã cài đặt.' });
      return this.snapshot;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.setSnapshot({ status: 'error', message: this.getErrorMessage(error) });
    }
    return this.snapshot;
  }

  async downloadUpdate(): Promise<AppUpdateSnapshot> {
    if (this.snapshot.status !== 'available') return this.snapshot;

    try {
      this.setSnapshot({ status: 'downloading', version: this.snapshot.version, progress: 0 });
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.setSnapshot({ status: 'error', version: this.snapshot.version, message: this.getErrorMessage(error) });
    }
    return this.snapshot;
  }

  quitAndInstall(): void {
    if (this.snapshot.status === 'downloaded') autoUpdater.quitAndInstall();
  }

  subscribe(listener: (snapshot: AppUpdateSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private handleUpdateAvailable(info: UpdateInfo): void {
    this.setSnapshot({ status: 'available', version: info.version });
  }

  private handleDownloadProgress(progress: ProgressInfo): void {
    this.setSnapshot({
      status: 'downloading',
      version: this.snapshot.version,
      progress: Math.round(progress.percent),
    });
  }

  private setSnapshot(snapshot: AppUpdateSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Không thể kiểm tra hoặc tải bản cập nhật.';
  }
}
