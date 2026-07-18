import { describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import { ElectronBackgroundCommandNotifier } from './ElectronBackgroundCommandNotifier.js';

describe('ElectronBackgroundCommandNotifier', () => {
  it('publishes drained notices only after a validated renderer is attached', async () => {
    const source = { drainRendererNotices: vi.fn(async () => [{ workspaceRoot: '/workspace', notice: {
      id: 'bg-1', scopeId: 'thread-1', description: 'Run tests', status: 'completed' as const,
      endedAt: '2026-07-18T00:00:00.000Z', exitCode: 0,
    } }]) };
    const dispatch = vi.fn(async () => ({ matchedHookIds: [], contexts: [], auditLabels: [] }));
    const notifier = new ElectronBackgroundCommandNotifier(source, { dispatch });
    const send = vi.fn();
    await notifier.attach({ isDestroyed: () => false, send } as unknown as WebContents);
    expect(send).toHaveBeenCalledWith('ai:background-command:event', expect.objectContaining({ id: 'bg-1' }));
    expect(send.mock.calls[0]?.[1]).not.toHaveProperty('workspaceRoot');
    expect(dispatch).toHaveBeenCalledWith({
      event: 'Notification', workspaceRoot: '/workspace', matchValue: 'background-command:completed',
      requestId: 'thread-1', taskId: 'bg-1',
    });
    notifier.stop();
  });

  it('does not drain when the renderer has already been destroyed', async () => {
    const source = { drainRendererNotices: vi.fn(async () => []) };
    const notifier = new ElectronBackgroundCommandNotifier(source);
    await notifier.attach({ isDestroyed: () => true, send: vi.fn() } as unknown as WebContents);
    expect(source.drainRendererNotices).not.toHaveBeenCalled();
    notifier.stop();
  });
});
