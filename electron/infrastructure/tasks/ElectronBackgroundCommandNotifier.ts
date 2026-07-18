import type { WebContents } from 'electron';
import type { IBackgroundCommandNoticeSource } from '../../domain/ports/IBackgroundCommandNoticeSource.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';

const POLL_INTERVAL_MS = 1_000;

export class ElectronBackgroundCommandNotifier {
  private readonly source: IBackgroundCommandNoticeSource;
  private readonly hooks?: ILifecycleHookDispatcher;
  private sender?: WebContents;
  private timer?: NodeJS.Timeout;
  private polling?: Promise<void>;

  constructor(source: IBackgroundCommandNoticeSource, hooks?: ILifecycleHookDispatcher) {
    this.source = source; this.hooks = hooks;
  }

  attach(sender: WebContents) {
    this.sender = sender;
    if (!this.timer) {
      this.timer = setInterval(() => { void this.poll(); }, POLL_INTERVAL_MS);
      this.timer.unref();
    }
    return this.poll();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.sender = undefined;
  }

  private poll() {
    if (this.polling) return this.polling;
    const sender = this.sender;
    if (!sender || sender.isDestroyed()) return Promise.resolve();
    this.polling = this.source.drainRendererNotices().then(async (deliveries) => {
      if (sender !== this.sender || sender.isDestroyed()) return;
      for (const delivery of deliveries) {
        sender.send('ai:background-command:event', delivery.notice);
        await this.hooks?.dispatch({
          event: 'Notification', workspaceRoot: delivery.workspaceRoot,
          matchValue: `background-command:${delivery.notice.status}`,
          requestId: delivery.notice.scopeId, taskId: delivery.notice.id,
        }).catch(() => undefined);
      }
    }).catch(() => undefined).finally(() => { this.polling = undefined; });
    return this.polling;
  }
}
