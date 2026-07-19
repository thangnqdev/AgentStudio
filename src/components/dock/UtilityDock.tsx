import { lazy, Suspense, useCallback, useState } from 'react';
import { useAgentDockReactions } from '../../application/hooks/useAgentDockReactions';
import type { AgentControlViewModel } from '../../application/hooks/useAgentControlSnapshot';
import { useUtilityDock } from '../../application/hooks/useUtilityDock';
import { useUtilityDockResize } from '../../application/hooks/useUtilityDockResize';
import { useUtilityDockShortcuts } from '../../application/hooks/useUtilityDockShortcuts';
import type { UtilityDockTab } from '../../domain/entities/utilityDock';
import { useAppStore } from '../../store/useAppStore';
import { AgentActivityDockView } from './AgentActivityDockView';
import { AgentDetailDockView } from './AgentDetailDockView';
import { DockBrowserView } from './DockBrowserView';
import { DockEvaluationsView } from './DockEvaluationsView';
import { DockFilesView } from './DockFilesView';
import { TaskDetailsDockView } from './TaskDetailsDockView';
import { UtilityDockLauncher } from './UtilityDockLauncher';
import { UtilityDockTabBar } from './UtilityDockTabBar';

const TerminalView = lazy(() => import('../TerminalView').then((module) => ({ default: module.TerminalView })));

export function UtilityDock({ control }: { control: AgentControlViewModel }) {
  const [launcherOpen, setLauncherOpen] = useState(false);
  const open = useAppStore((state) => state.isUtilityDockOpen);
  const width = useAppStore((state) => state.utilityDockWidth);
  const tabs = useAppStore((state) => state.utilityDockTabs);
  const activeTabId = useAppStore((state) => state.activeUtilityDockTabId);
  const activeThreadId = useAppStore((state) => state.activeThreadId);
  const setWidth = useAppStore((state) => state.setUtilityDockWidth);
  const activate = useAppStore((state) => state.activateUtilityDockTab);
  const close = useAppStore((state) => state.closeUtilityDockTab);
  const resize = useUtilityDockResize(width, setWidth);
  const { openActivity, openTool, openAgent } = useUtilityDock();
  useUtilityDockShortcuts(openTool);
  const showAttention = useCallback((participantId: string) => {
    const participant = control.snapshot.participants.find((item) => item.id === participantId);
    if (participant) openAgent(participant);
  }, [control.snapshot.participants, openAgent]);
  useAgentDockReactions(activeThreadId, control.snapshot, openActivity, showAttention);

  return (
    <aside aria-label="Hoạt động và công cụ" aria-hidden={!open} inert={!open} className={`relative z-30 shrink-0 overflow-hidden border-l bg-white transition-[width] duration-200 max-[980px]:absolute max-[980px]:inset-y-0 max-[980px]:right-0 max-[980px]:shadow-[-18px_0_45px_rgba(0,0,0,0.14)] ${open ? 'border-black/[0.08]' : 'border-transparent'}`} style={{ width: open ? `min(100vw, ${width}px)` : 0 }}>
      <div className="flex h-full flex-col" style={{ width: `min(100vw, ${width}px)` }}>
        <div onPointerDown={resize} className="absolute inset-y-0 left-0 z-40 w-1 cursor-col-resize hover:bg-[#a33d1f]/30" aria-hidden="true" />
        <header className="relative flex h-10 shrink-0 items-center gap-2 border-b border-black/[0.07] px-3">
          <span className="material-symbols-outlined text-[16px] text-[#666]">side_navigation</span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#555]">Hoạt động & công cụ</span>
          {control.snapshot.metrics.attention > 0 && <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-semibold text-orange-700">{control.snapshot.metrics.attention} cần bạn</span>}
          <button type="button" onClick={() => setLauncherOpen((value) => !value)} className="dock-icon-button" title="Mở công cụ"><span className="material-symbols-outlined text-[17px]">add</span></button>
          <UtilityDockLauncher open={launcherOpen} onClose={() => setLauncherOpen(false)} onOpenActivity={openActivity} onOpenTool={openTool} />
        </header>
        <UtilityDockTabBar tabs={tabs} activeTabId={activeTabId} onActivate={activate} onClose={close} />
        <div className="relative flex min-h-0 flex-1 flex-col">
          {tabs.filter((tab) => tab.surface === 'terminal').map((tab) => (
            <div key={tab.id} className={tab.id === activeTabId ? 'flex min-h-0 flex-1' : 'hidden'}>
              <Suspense fallback={<div className="flex-1 bg-[#141312]" />}><TerminalView compact /></Suspense>
            </div>
          ))}
          {activeTabId && <ActiveDockPanel activeTab={tabs.find((tab) => tab.id === activeTabId)} control={control} onOpenAgent={openAgent} />}
        </div>
      </div>
    </aside>
  );
}

function ActiveDockPanel(props: {
  activeTab?: UtilityDockTab;
  control: AgentControlViewModel;
  onOpenAgent: (participant: AgentControlViewModel['snapshot']['participants'][number]) => void;
}) {
  const tab = props.activeTab;
  if (!tab || tab.surface === 'terminal') return null;
  if (tab.surface === 'activity') return <AgentActivityDockView control={props.control} onOpenAgent={props.onOpenAgent} />;
  if (tab.surface === 'agent') return <AgentDetailDockView agentId={tab.agentId} control={props.control} />;
  if (tab.surface === 'files') return <DockFilesView />;
  if (tab.surface === 'browser') return <DockBrowserView />;
  if (tab.surface === 'evaluations') return <DockEvaluationsView />;
  return <TaskDetailsDockView />;
}
