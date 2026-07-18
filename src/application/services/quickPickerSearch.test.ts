import { describe, expect, it } from 'vitest';
import { filterQuickPickerItems } from './quickPickerSearch';

const items = [
  { value: 'one', label: 'Sửa kiểm thử', description: 'Tạm dừng · 12 bước', searchText: 'timeout task-abc' },
  { value: 'two', label: 'Refactor provider', description: 'Lỗi · 4 bước', searchText: 'stream failure task-def' },
];

describe('filterQuickPickerItems', () => {
  it('matches every normalized token across labels, descriptions, and hidden metadata', () => {
    expect(filterQuickPickerItems(items, 'kiem thu timeout')).toEqual([items[0]]);
    expect(filterQuickPickerItems(items, 'LỖI stream')).toEqual([items[1]]);
    expect(filterQuickPickerItems(items, 'task-def')).toEqual([items[1]]);
  });

  it('preserves item order for an empty query and excludes unrelated tasks', () => {
    expect(filterQuickPickerItems(items, '  ')).toBe(items);
    expect(filterQuickPickerItems(items, 'not-found')).toEqual([]);
  });
});
