type SearchablePickerItem = { label: string; description?: string; searchText?: string };

export function filterQuickPickerItems<T extends SearchablePickerItem>(items: T[], query: string): T[] {
  const terms = normalize(query).split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return items;
  return items.filter((item) => {
    const candidate = normalize([item.label, item.description, item.searchText].filter(Boolean).join(' '));
    return terms.every((term) => candidate.includes(term));
  });
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase().trim();
}
