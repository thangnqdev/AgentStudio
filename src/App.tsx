import { lazy, Suspense, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopAppBar } from './components/TopAppBar';
import { ChatArea } from './components/ChatArea';
import { PromptComposer } from './components/PromptComposer';
import { PlaceholderView } from './components/PlaceholderView';
import { SettingsView } from './components/SettingsView';
import { useAppStore, type AppSettings, type Attachment, type ChatThread, type Message, type ViewId } from './store/useAppStore';

const LEGACY_SETTINGS_KEY = 'architect-app-settings';
const CHAT_HISTORY_SAVE_DELAY_MS = 700;
const MAX_HISTORY_THREADS = 80;
const MAX_HISTORY_MESSAGES_PER_THREAD = 120;
const TerminalView = lazy(() => import('./components/TerminalView').then((module) => ({ default: module.TerminalView })));

function compactAttachmentForHistory(attachment: Attachment): Attachment {
  return {
    id: attachment.id,
    name: attachment.name,
    type: attachment.type,
    filePath: attachment.filePath,
    mimeType: attachment.mimeType,
    size: attachment.size,
    data: attachment.filePath ? undefined : attachment.data,
  };
}

function compactMessageForHistory(message: Message): Message {
  return {
    ...message,
    attachments: message.attachments?.map(compactAttachmentForHistory),
  };
}

function compactThreadsForHistory(threads: ChatThread[]) {
  return threads.slice(0, MAX_HISTORY_THREADS).map((thread) => ({
    ...thread,
    messages: thread.messages.slice(-MAX_HISTORY_MESSAGES_PER_THREAD).map(compactMessageForHistory),
  }));
}

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
  if (view === 'terminal') {
    return (
      <Suspense fallback={<div className="flex-1 bg-[#141312]" />}>
        <TerminalView />
      </Suspense>
    );
  }
  return <PlaceholderView view={view} />;
}

function App() {
  const activeView = useAppStore((s) => s.activeView);
  const workspacePath = useAppStore((s) => s.settings.workspacePath);
  const threads = useAppStore((s) => s.threads);
  const activeThreadId = useAppStore((s) => s.activeThreadId);
  const setSettings = useAppStore((s) => s.setSettings);
  const setProjectPath = useAppStore((s) => s.setProjectPath);
  const replaceChatHistory = useAppStore((s) => s.replaceChatHistory);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

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
          setProjectPath(settings.workspacePath);
        }
      })
      .catch((error) => {
        console.error('Failed to load local AI settings', error);
      });

    return () => {
      cancelled = true;
    };
  }, [setProjectPath, setSettings]);

  useEffect(() => {
    let cancelled = false;
    if (!window.agentStudio || !workspacePath || workspacePath === 'chưa có dự án') return;

    setIsHistoryLoaded(false);
    window.agentStudio.loadChatHistory(workspacePath)
      .then((history) => {
        if (cancelled) return;
        replaceChatHistory(history.threads, history.activeThreadId);
        setIsHistoryLoaded(true);
      })
      .catch((error) => {
        console.error('Failed to load workspace chat history', error);
        if (!cancelled) {
          replaceChatHistory([], null);
          setIsHistoryLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [replaceChatHistory, workspacePath]);

  useEffect(() => {
    if (!isHistoryLoaded || !window.agentStudio || !workspacePath || workspacePath === 'chưa có dự án') return;

    const timeoutId = window.setTimeout(() => {
      void window.agentStudio?.saveChatHistory({
        workspacePath,
        threads: compactThreadsForHistory(threads),
        activeThreadId,
      }).catch((error) => {
        console.error('Failed to save workspace chat history', error);
      });
    }, CHAT_HISTORY_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeThreadId, isHistoryLoaded, threads, workspacePath]);

  return (
    <div className="w-screen h-screen flex flex-col text-on-surface font-ui-body bg-background overflow-hidden">
      <TopAppBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col bg-background canvas-glow relative overflow-hidden">
          <MainContent view={activeView} />
        </main>
      </div>
    </div>
  );
}

export default App;
