import { describe, expect, it, vi } from 'vitest';
import { SimpleGitAdapter } from './SimpleGitAdapter.js';

describe('SimpleGitAdapter', () => {
  it('invokes git with a fixed argument array and authoritative cwd', async () => {
    const runGit = vi.fn(async () => ({ stdout: 'feature/test\n' }));
    const adapter = new SimpleGitAdapter(runGit);
    await expect(adapter.getBranch('/workspace')).resolves.toBe('feature/test');
    expect(runGit).toHaveBeenCalledWith('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: '/workspace', encoding: 'utf8' });
  });

  it('returns null outside a git repository', async () => {
    const adapter = new SimpleGitAdapter(async () => { throw new Error('not a repository'); });
    await expect(adapter.getBranch('/workspace')).resolves.toBeNull();
  });
});
