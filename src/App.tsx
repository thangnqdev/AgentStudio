import { Sidebar } from './components/Sidebar';
import { TopAppBar } from './components/TopAppBar';
import { ChatArea } from './components/ChatArea';
import { PromptComposer } from './components/PromptComposer';
import { PlaceholderView } from './components/PlaceholderView';
import { SettingsView } from './components/SettingsView';
import { useAppStore, type ViewId } from './store/useAppStore';

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
  return <PlaceholderView view={view} />;
}

function App() {
  const activeView = useAppStore((s) => s.activeView);

  return (
    <div className="w-screen h-screen flex text-on-surface font-ui-body bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col bg-background canvas-glow relative overflow-hidden">
        <TopAppBar />
        <MainContent view={activeView} />
      </main>
    </div>
  );
}

export default App;
