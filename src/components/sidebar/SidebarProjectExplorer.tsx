import { useMemo, useRef, useState } from 'react';
import { useWorkspaceProjects } from '../../application/hooks/useWorkspaceProjects';
import type { WorkspaceProjectSummary } from '../../domain/entities/workspaceProject';
import { useAppStore } from '../../store/useAppStore';

const INITIAL_THREAD_LIMIT = 5;

export function SidebarProjectExplorer() {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const currentPath = useAppStore((state) => state.settings.workspacePath);
  const currentThreads = useAppStore((state) => state.threads);
  const activeThreadId = useAppStore((state) => state.activeThreadId);
  const { projects, loading, error, addProject, openProject, removeProject } = useWorkspaceProjects();

  // Ổn định thứ tự projects — không reorder khi refresh() trả về list mới từ server
  const stableProjectOrderRef = useRef<string[]>([]);
  // Ổn định thứ tự threads bên trong project đang active — không re-sort khi đổi active thread
  const stableThreadOrderRef = useRef<Record<string, string[]>>({});

  const visibleProjects = useMemo(() => {
    // Cập nhật stable order: giữ nguyên vị trí cũ, thêm project mới vào cuối
    const existingPaths = new Set(stableProjectOrderRef.current);
    const newPaths = projects.map((p) => p.path).filter((path) => !existingPaths.has(path));
    stableProjectOrderRef.current = [
      ...stableProjectOrderRef.current.filter((path) => projects.some((p) => p.path === path)),
      ...newPaths,
    ];

    // Sắp xếp projects theo thứ tự ổn định đã lưu
    const projectMap = new Map(projects.map((p) => [p.path, p]));
    const sortedProjects = stableProjectOrderRef.current
      .map((path) => projectMap.get(path))
      .filter(Boolean) as WorkspaceProjectSummary[];

    return sortedProjects.map((project) => {
      const isActive = samePath(project.path, currentPath);
      if (!isActive) return project;

      const threads = currentThreads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        updatedAt: thread.updatedAt.toISOString(),
      }));

      // Giữ nguyên thứ tự threads, chỉ append thread mới vào cuối
      const prevOrder = stableThreadOrderRef.current[project.path] ?? [];
      const existingIds = new Set(prevOrder);
      const newIds = threads.map((t) => t.id).filter((id) => !existingIds.has(id));
      const stableOrder = [
        ...prevOrder.filter((id) => threads.some((t) => t.id === id)),
        ...newIds,
      ];
      stableThreadOrderRef.current[project.path] = stableOrder;

      const sortedThreads = stableOrder
        .map((id) => threads.find((t) => t.id === id))
        .filter(Boolean) as typeof threads;

      return { ...project, activeThreadId, threads: sortedThreads };
    });
  }, [activeThreadId, currentPath, currentThreads, projects]);

  return (
    <section className="flex min-h-0 flex-1 flex-col px-2" aria-label="Dự án và chat">
      <div className="group/header flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-left text-[11px] font-medium text-on-surface-variant hover:bg-interactive-hover"
          aria-expanded={open}
        >
          <span className="material-symbols-outlined text-[14px]">{open ? 'expand_more' : 'chevron_right'}</span>
          <span className="min-w-0 flex-1 truncate">Dự án</span>
        </button>
        <button
          type="button"
          onClick={() => void addProject()}
          className="dock-icon-button opacity-0 transition-opacity group-hover/header:opacity-100"
          title="Thêm thư mục dự án"
          aria-label="Thêm thư mục dự án"
        >
          <span className="material-symbols-outlined text-[17px]">add</span>
        </button>
      </div>

      {open && (
        <div className="mt-1 min-h-0 flex-1 overflow-y-auto pb-3">
          {loading && <p className="px-2 py-2 text-[11px] text-on-surface-variant">Đang tải dự án…</p>}
          {!loading && visibleProjects.length === 0 && <EmptyProjects onAdd={() => void addProject()} />}
          {visibleProjects.map((project) => (
            <ProjectGroup
              key={project.path}
              project={project}
              active={samePath(project.path, currentPath)}
              activeThreadId={activeThreadId}
              showAll={Boolean(expanded[project.path])}
              onShowAll={() => setExpanded((state) => ({ ...state, [project.path]: true }))}
              onOpen={(threadId) => void openProject(project, threadId)}
              onRemove={() => void removeProject(project.path)}
            />
          ))}
          {error && <p className="mx-1 mt-2 rounded-md bg-error-container px-2 py-1.5 text-[10px] text-on-error-container">{error}</p>}
        </div>
      )}
    </section>
  );
}

function ProjectGroup(props: {
  project: WorkspaceProjectSummary;
  active: boolean;
  activeThreadId: string | null;
  showAll: boolean;
  onShowAll: () => void;
  onOpen: (threadId?: string) => void;
  onRemove: () => void;
}) {
  const threads = props.showAll ? props.project.threads : props.project.threads.slice(0, INITIAL_THREAD_LIMIT);
  return (
    <div className="group/project mb-3">
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => props.onOpen(props.project.activeThreadId ?? undefined)}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] font-medium ${props.active ? 'text-on-surface' : 'text-on-surface-variant hover:bg-interactive-hover'}`}
          title={props.project.path}
        >
          <span className="material-symbols-outlined text-[14px]">folder</span>
          <span className="truncate">{props.project.name}</span>
        </button>
        {!props.active && (
          <button type="button" onClick={props.onRemove} className="invisible dock-icon-button group-hover/project:visible" title="Ẩn khỏi danh sách">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        )}
      </div>
      <div className="mt-0.5 pl-6 pr-1">
        {threads.map((thread) => (
          <button key={thread.id} type="button" onClick={() => props.onOpen(thread.id)} title={thread.title}
            className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-[11px] ${props.active && thread.id === props.activeThreadId ? 'bg-interactive-selected text-on-surface' : 'text-on-surface-variant hover:bg-interactive-hover'}`}>
            {thread.title}
          </button>
        ))}
        {props.project.threads.length === 0 && <p className="px-2 py-1 text-[10px] text-on-surface-variant/70">Chưa có chat</p>}
        {!props.showAll && props.project.threads.length > INITIAL_THREAD_LIMIT && (
          <button type="button" onClick={props.onShowAll} className="px-2 py-1 text-[10px] text-on-surface-variant hover:text-on-surface">Hiển thị thêm</button>
        )}
      </div>
    </div>
  );
}

function EmptyProjects({ onAdd }: { onAdd: () => void }) {
  return <button type="button" onClick={onAdd} className="mx-1 rounded-lg border border-dashed border-outline-variant px-3 py-3 text-left text-[11px] text-on-surface-variant hover:bg-interactive-hover">Thêm thư mục để bắt đầu một dự án.</button>;
}

function samePath(left: string, right: string) {
  return Boolean(left) && left.toLocaleLowerCase() === right.toLocaleLowerCase();
}
