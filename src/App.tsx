import { lazy, Suspense } from 'react';
import { useSettingsSync } from './application/hooks/useSettingsSync';
import { useWorkspaceChatHistory } from './application/hooks/useWorkspaceChatHistory';
import { useAgentControlSnapshot } from './application/hooks/useAgentControlSnapshot';
import { AgentProfilesView } from './components/AgentProfilesView';
import { AiSetupDialog } from './components/AiSetupDialog';
import { BridgeUnavailableView } from './components/BridgeUnavailableView';
import { CapabilityView } from './components/CapabilityView';
import { EvaluationView } from './components/EvaluationView';
import { KnowledgeView } from './components/KnowledgeView';
import { OptimizerView } from './components/OptimizerView';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { SkillLearningView } from './components/SkillLearningView';
import { TopAppBar } from './components/TopAppBar';
import { TraceView } from './components/TraceView';
import { WorkflowView } from './components/WorkflowView';
import { BackgroundCommandToasts } from './components/chat/BackgroundCommandToasts';
import { BrowserWorkspaceView } from './components/workspace/BrowserWorkspaceView';
import { FilesWorkspaceView } from './components/workspace/FilesWorkspaceView';
import { TaskWorkspace } from './components/workspace/TaskWorkspace';
import { WorkspaceLauncher } from './components/workspace/WorkspaceLauncher';
import { UtilityDock } from './components/dock/UtilityDock';
import { hasUsableAiConfiguration } from './domain/services/aiConfiguration';
import { useAppStore, type ViewId } from './store/useAppStore';

const TerminalView = lazy(() => import('./components/TerminalView').then((module) => ({ default: module.TerminalView })));

function MainContent({ view }: { view: ViewId }) {
  if (view === 'tasks') return <TaskWorkspace />;
  if (view === 'settings') return <SettingsView />;
  if (view === 'knowledge') return <KnowledgeView />;
  if (view === 'observability') return <TraceView />;
  if (view === 'evaluations') return <EvaluationView />;
  if (view === 'workflows') return <WorkflowView />;
  if (view === 'capabilities') return <CapabilityView />;
  if (view === 'optimizer') return <OptimizerView />;
  if (view === 'skill-learning') return <SkillLearningView />;
  if (view === 'agents') return <AgentProfilesView />;
  if (view === 'browser') return <BrowserWorkspaceView />;
  if (view === 'files') return <FilesWorkspaceView />;
  if (view === 'terminal') return <TerminalSurface />;
  return null;
}

function TerminalSurface() {
  return (
    <Suspense fallback={<div className="flex-1 bg-[#141312]" />}>
      <TerminalView />
    </Suspense>
  );
}

function App() {
  const isSettingsLoaded = useSettingsSync();
  const activeView = useAppStore((state) => state.activeView);
  const activeWorkspaceTabId = useAppStore((state) => state.activeWorkspaceTabId);
  const settings = useAppStore((state) => state.settings);
  const isUtilityDockOpen = useAppStore((state) => state.isUtilityDockOpen);
  const setUtilityDockOpen = useAppStore((state) => state.setUtilityDockOpen);
  const workspacePath = useAppStore((state) => state.settings.workspacePath);
  const threads = useAppStore((state) => state.threads);
  const activeThreadId = useAppStore((state) => state.activeThreadId);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const { bridgeAvailable } = useWorkspaceChatHistory({
    workspacePath, threads, activeThreadId, settingsLoaded: isSettingsLoaded,
  });
  const agentControl = useAgentControlSnapshot(activeThreadId);
  const shouldShowAiSetup = Boolean(activeWorkspaceTabId)
    && isSettingsLoaded
    && activeView !== 'settings'
    && !hasUsableAiConfiguration(settings);

  if (!bridgeAvailable) return <BridgeUnavailableView />;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-ui-body text-on-surface">
      <Sidebar />
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopAppBar agentMetrics={agentControl.snapshot.metrics} />
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
            {activeWorkspaceTabId ? <MainContent view={activeView} /> : <WorkspaceLauncher />}
          </main>
          {isUtilityDockOpen && <button type="button" aria-label="Đóng cánh phải" onClick={() => setUtilityDockOpen(false)} className="absolute inset-0 z-20 hidden bg-overlay max-[980px]:block" />}
          <UtilityDock control={agentControl} />
        </div>
      </section>
      {shouldShowAiSetup && <AiSetupDialog onOpenSettings={() => setActiveView('settings')} />}
      <BackgroundCommandToasts />
    </div>
  );
}

export default App;
