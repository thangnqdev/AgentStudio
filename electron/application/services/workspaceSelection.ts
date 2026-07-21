export const NO_WORKSPACE_SELECTED = '';
export const MAX_RECENT_WORKSPACES = 12;

export function normalizeWorkspacePath(value: unknown): string {
  return typeof value === 'string' ? value.trim() : NO_WORKSPACE_SELECTED;
}

export function requireWorkspacePath(value: unknown): string {
  const workspacePath = normalizeWorkspacePath(value);
  if (!workspacePath) throw new Error('Chưa chọn workspace.');
  return workspacePath;
}

export function normalizeRecentWorkspacePaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, string>();
  for (const item of value) {
    const workspacePath = normalizeWorkspacePath(item);
    if (!workspacePath) continue;
    const key = process.platform === 'win32' ? workspacePath.toLocaleLowerCase() : workspacePath;
    if (!unique.has(key)) unique.set(key, workspacePath);
  }
  return [...unique.values()].slice(0, MAX_RECENT_WORKSPACES);
}

export function rememberWorkspacePath(paths: readonly string[], value: unknown): string[] {
  const workspacePath = requireWorkspacePath(value);
  return normalizeRecentWorkspacePaths([workspacePath, ...paths]);
}
