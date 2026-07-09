import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopAppBar } from './components/TopAppBar';
import { ChatArea } from './components/ChatArea';
import { PromptComposer } from './components/PromptComposer';
import { PlaceholderView } from './components/PlaceholderView';
import { SettingsView } from './components/SettingsView';
import { useAppStore, type AppSettings, type ViewId } from './store/useAppStore';

const LEGACY_SETTINGS_KEY = 'architect-app-settings';

function readLegacySettings(): AppSettings | null {
  const rawSettings = localStorage.getItem(LEGACY_SETTINGS_KEY);
  if (!rawSettings) return null;

  try {
    const parsed = JSON.parse(rawSettings) as { state?: { settings?: AppSettings } };
    return parsed.state?.settings ?? null;
  } catch {
    return null;
  }
}

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
  const setSettings = useAppStore((s) => s.setSettings);

  useEffect(() => {
    let cancelled = false;

    if (!window.agentStudio) {
      console.warn('Electron bridge is not available. Skipping local settings load.');
      return () => {
        cancelled = true;
      };
    }

    const legacySettings = readLegacySettings();
    const settingsPromise = legacySettings
      ? window.agentStudio.importLegacySettings(legacySettings).then((settings) => {
          localStorage.removeItem(LEGACY_SETTINGS_KEY);
          return settings;
        })
      : window.agentStudio.loadSettings();

    settingsPromise
      .then((settings) => {
        if (!cancelled) {
          setSettings(settings);
        }
      })
      .catch((error) => {
        console.error('Failed to load local AI settings', error);
      });

    return () => {
      cancelled = true;
    };
  }, [setSettings]);

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
