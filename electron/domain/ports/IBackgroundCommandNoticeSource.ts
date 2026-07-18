import type { BackgroundCommandRendererDelivery } from '../entities/backgroundCommand.js';

export interface IBackgroundCommandNoticeSource {
  drainRendererNotices(): Promise<BackgroundCommandRendererDelivery[]>;
}
