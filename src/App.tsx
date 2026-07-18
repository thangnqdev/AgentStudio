import { lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopAppBar } from './components/TopAppBar';
import { ChatArea } from './components/ChatArea';
import { PromptComposer } from './components/PromptComposer';
import { SettingsView } from './components/SettingsView';
import { AiSetupDialog } from './components/AiSetupDialog';
import { KnowledgeView } from './components/KnowledgeView';
import { TraceView } from './components/TraceView';
import { EvaluationView } from './components/EvaluationView';
import { WorkflowView } from './components/WorkflowView';
import { CapabilityView } from './components/CapabilityView';
import { OptimizerView } from './components/OptimizerView';
import { SkillLearningView } from './components/SkillLearningView';
import { AgentProfilesView } from './components/AgentProfilesView';
import { BridgeUnavailableView } from './components/BridgeUnavailableView';
import { useAppStore, type ViewId } from './store/useAppStore';
import { hasUsableAiConfiguration } from './domain/services/aiConfiguration';
import { useSettingsSync } from './application/hooks/useSettingsSync';
import { BackgroundCommandToasts } from './components/chat/BackgroundCommandToasts';
import { useWorkspaceChatHistory } from './application/hooks/useWorkspaceChatHistory';

const TerminalView = lazy(() => import('./components/TerminalView').then((module) => ({ default: module.TerminalView })));

function MainContent({ view }: { view: ViewId }) {
  if (view === 'tasks') {
    return (
      <>
        <ChatArea />
        <PromptComposer />
      </>
    );
  }
  if (view === 'settings') {
    return <SettingsView />;
  }
  if (view === 'knowledge') {
    return <KnowledgeView />;
  }
  if (view === 'observability') {
    return <TraceView />;
  }
  if (view === 'evaluations') {
    return <EvaluationView />;
  }
  if (view === 'workflows') {
    return <WorkflowView />;
  }
  if (view === 'capabilities') {
    return <CapabilityView />;
  }
  if (view === 'optimizer') {
    return <OptimizerView />;
  }
  if (view === 'skill-learning') {
    return <SkillLearningView />;
  }
  if (view === 'agents') {
    return <AgentProfilesView />;
  }
  return null;
}

function App() {
  const isSettingsLoaded = useSettingsSync();
  const activeView = useAppStore((s) => s.activeView);
  const settings = useAppStore((s) => s.settings);
  const isTerminalOpen = useAppStore((s) => s.isTerminalOpen);
  const workspacePath = useAppStore((s) => s.settings.workspacePath);
  const threads = useAppStore((s) => s.threads);
  const activeThreadId = useAppStore((s) => s.activeThreadId);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const { bridgeAvailable } = useWorkspaceChatHistory({
    workspacePath, threads, activeThreadId, settingsLoaded: isSettingsLoaded,
  });
  const shouldShowAiSetup = isSettingsLoaded && activeView !== 'settings' && !hasUsableAiConfiguration(settings);

  if (!bridgeAvailable) return <BridgeUnavailableView />;

  return (
    <div className="w-screen h-screen flex flex-col text-on-surface font-ui-body bg-background overflow-hidden">
      <TopAppBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col bg-background canvas-glow relative overflow-hidden">
          <MainContent view={activeView} />
        </main>
        {isTerminalOpen && (
          <aside className="w-[500px] border-l border-outline-variant bg-[#141312] flex flex-col shrink-0 shadow-[-4px_0_12px_rgba(0,0,0,0.1)]">
            <Suspense fallback={<div className="flex-1 bg-[#141312]" />}>
              <TerminalView />
            </Suspense>
          </aside>
        )}
      </div>
      {shouldShowAiSetup && <AiSetupDialog onOpenSettings={() => setActiveView('settings')} />}
      <BackgroundCommandToasts />
    </div>
  );
}

export default App;
