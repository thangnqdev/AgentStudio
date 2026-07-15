import { describe, expect, it } from 'vitest';
import { ElectronUserInteractionManager } from './ElectronUserInteractionManager.js';

describe('ElectronUserInteractionManager', () => {
  it('resolves only the matching request and interaction', async () => {
    const manager = new ElectronUserInteractionManager(1_000);
    const pending = manager.waitForResponse('request-1', 'interaction-1');
    expect(manager.respond('request-1', 'other', { accepted: false })).toBe(false);
    expect(manager.respond('request-1', 'interaction-1', { accepted: true, answers: { q: 'a' } })).toBe(true);
    await expect(pending).resolves.toEqual({ accepted: true, answers: { q: 'a' } });
  });

  it('rejects all pending interactions when a request is cancelled', async () => {
    const manager = new ElectronUserInteractionManager(1_000);
    const pending = manager.waitForResponse('request-1', 'interaction-1');
    manager.cancelRequest('request-1');
    await expect(pending).rejects.toThrow('stopped');
  });
});
