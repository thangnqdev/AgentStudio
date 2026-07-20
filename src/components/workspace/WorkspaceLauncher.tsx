import { useWorkspaceTabs } from '../../application/hooks/useWorkspaceTabs';
import type { WorkspaceLaunchAction } from './workspaceLaunchOptions';
import { WORKSPACE_LAUNCH_OPTIONS } from './workspaceLaunchOptions';

export function WorkspaceLauncher() {
  const { createTask, openSurface } = useWorkspaceTabs();

  const open = (action: WorkspaceLaunchAction) => {
    if (action === 'new-task') createTask();
    else if (action === 'side-task') createTask(true);
    else openSurface(action, true);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-workspace">
      <div className="min-h-full flex items-center justify-center px-8 py-16">
        <section className="w-full max-w-[720px]">
          <div className="mb-9 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-outline-variant/60 bg-surface shadow-sm">
              <span className="material-symbols-outlined text-[22px] text-on-surface">deployed_code</span>
            </div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-on-surface">Mở một không gian làm việc</h1>
            <p className="mt-2 text-[13px] text-on-surface-variant">Bắt đầu tác vụ mới hoặc chọn công cụ cho tab tiếp theo.</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 max-[760px]:grid-cols-1">
            {WORKSPACE_LAUNCH_OPTIONS.map((option) => (
              <button
                key={option.action}
                type="button"
                onClick={() => open(option.action)}
                className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-outline-variant/60 bg-surface px-4 text-left shadow-[0_1px_2px_var(--theme-shadow)] transition hover:border-outline-variant/80 hover:bg-surface-container-low hover:shadow-sm"
              >
                <span className="material-symbols-outlined flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-[19px] text-on-surface-variant group-hover:text-on-surface">
                  {option.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-on-surface">{option.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-on-surface-variant">{option.description}</span>
                </span>
                {option.shortcut && <kbd className="text-[10px] text-on-surface-variant">{option.shortcut}</kbd>}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
