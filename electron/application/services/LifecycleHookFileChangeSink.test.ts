import { describe, expect, it, vi } from 'vitest';
import { CompositeWorkspaceFileChangeSink } from './CompositeWorkspaceFileChangeSink.js';
import { LifecycleHookFileChangeSink, relativeWorkspacePath } from './LifecycleHookFileChangeSink.js';

describe('workspace file change sinks', () => {
  it('dispatches a relative audit-only file event', async () => {
    const dispatch = vi.fn(async () => ({ matchedHookIds: [], contexts: [], auditLabels: [] }));
    await new LifecycleHookFileChangeSink({ dispatch }).fileChanged('/workspace/src/main.ts', '/workspace');
    expect(dispatch).toHaveBeenCalledWith({ event: 'FileChanged', workspaceRoot: '/workspace', matchValue: 'src/main.ts' });
    expect(relativeWorkspacePath('C:\\repo\\src\\main.ts', 'C:\\repo')).toBe('src/main.ts');
  });

  it('notifies every sink even when one fails', async () => {
    const second = vi.fn(async () => undefined);
    const composite = new CompositeWorkspaceFileChangeSink([
      { fileChanged: async () => { throw new Error('LSP unavailable'); } },
      { fileChanged: second },
    ]);
    await expect(composite.fileChanged('/workspace/a.ts', '/workspace')).resolves.toBeUndefined();
    expect(second).toHaveBeenCalledOnce();
  });
});
