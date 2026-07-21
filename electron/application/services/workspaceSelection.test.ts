import { describe, expect, it } from 'vitest';
import {
  normalizeRecentWorkspacePaths,
  normalizeWorkspacePath,
  rememberWorkspacePath,
  requireWorkspacePath,
} from './workspaceSelection.js';

describe('workspaceSelection', () => {
  it('keeps first-run settings unselected instead of using the process directory', () => {
    expect(normalizeWorkspacePath(undefined)).toBe('');
    expect(normalizeWorkspacePath('   ')).toBe('');
  });

  it('normalizes a selected path and rejects an absent selection', () => {
    expect(normalizeWorkspacePath('  D:\\Projects\\demo  ')).toBe('D:\\Projects\\demo');
    expect(() => requireWorkspacePath('')).toThrow('Chưa chọn workspace.');
  });

  it('keeps recent workspaces unique with the selected path first', () => {
    expect(rememberWorkspacePath(['D:\\One', 'D:\\Two', 'D:\\One'], 'D:\\Two')).toEqual([
      'D:\\Two',
      'D:\\One',
    ]);
    expect(normalizeRecentWorkspacePaths(['', null, 'D:\\One'])).toEqual(['D:\\One']);
  });
});
