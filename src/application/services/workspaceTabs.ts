import type { OpenWorkspaceTabInput, WorkspaceSurface, WorkspaceTab } from '../../domain/entities/workspaceTab';

const SURFACE_TITLES: Record<WorkspaceSurface, string> = {
  tasks: 'Tác vụ mới', knowledge: 'Cơ sở tri thức', observability: 'Quan sát agent', evaluations: 'Đánh giá',
  workflows: 'Tự động hóa', capabilities: 'Công cụ & kết nối', optimizer: 'Tối ưu an toàn', 'skill-learning': 'Kỹ năng đã học',
  agents: 'Hồ sơ agent', settings: 'Cài đặt', terminal: 'Dòng lệnh', browser: 'Trình duyệt', files: 'Tệp',
};

type OpenTabResult = {
  tabs: WorkspaceTab[];
  activeTabId: string;
};

type CloseTabResult = {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
};

export function openWorkspaceTab(
  tabs: WorkspaceTab[],
  input: OpenWorkspaceTabInput,
  createId: () => string,
): OpenTabResult {
  const reusable = input.reuseKey
    ? tabs.find((tab) => workspaceTabKey(tab) === input.reuseKey)
    : undefined;
  if (reusable) return { tabs, activeTabId: reusable.id };

  const { reuseKey: _reuseKey, ...tab } = input;
  const created = { ...tab, id: createId() };
  return { tabs: [...tabs, created], activeTabId: created.id };
}

export function closeWorkspaceTab(
  tabs: WorkspaceTab[],
  activeTabId: string | null,
  tabId: string,
): CloseTabResult {
  const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
  if (closingIndex < 0) return { tabs, activeTabId };

  const remaining = tabs.filter((tab) => tab.id !== tabId);
  if (activeTabId !== tabId) return { tabs: remaining, activeTabId };

  const fallback = remaining[Math.min(closingIndex, remaining.length - 1)];
  return { tabs: remaining, activeTabId: fallback?.id ?? null };
}

export function workspaceTabKey(tab: Pick<WorkspaceTab, 'surface' | 'threadId'>): string {
  return tab.surface === 'tasks' && tab.threadId
    ? `tasks:${tab.threadId}`
    : tab.surface;
}

export function workspaceSurfaceTitle(surface: WorkspaceSurface): string {
  return SURFACE_TITLES[surface];
}
