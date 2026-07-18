import { describe, expect, it, vi } from 'vitest';
import { WorkspaceLspServerRegistry } from './WorkspaceLspServerRegistry.js';

describe('WorkspaceLspServerRegistry', () => {
  it('exposes trusted configurations and refreshes when they are removed', async () => {
    const list = vi.fn(async () => [{
      name: 'plugin:typescript:server', command: 'typescript-language-server', args: ['--stdio'],
      extensionToLanguage: { '.ts': 'typescript' },
    }]);
    const registry = new WorkspaceLspServerRegistry({ list });
    await expect(registry.isAvailable(process.cwd())).resolves.toBe(true);
    list.mockResolvedValue([]);
    await expect(registry.isAvailable(process.cwd())).resolves.toBe(false);
    expect(list).toHaveBeenCalledTimes(2);
    await registry.shutdownAll();
  });
});
