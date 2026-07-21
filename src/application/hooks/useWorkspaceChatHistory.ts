import { useEffect, useRef, useState } from 'react';
import type { ChatThread } from '../../domain/entities/chatThread';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';
import { useAppStore } from '../../store/useAppStore';
import { projectChatHistory } from '../services/chatHistoryProjection';

const SAVE_DELAY_MS = 700;

export function useWorkspaceChatHistory(input: {
  workspacePath?: string;
  threads: ChatThread[];
  activeThreadId: string | null;
  settingsLoaded: boolean;
}) {
  const replaceChatHistory = useAppStore((state) => state.replaceChatHistory);
  const requestWorkspaceThread = useAppStore((state) => state.requestWorkspaceThread);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loadedWorkspace, setLoadedWorkspace] = useState<string | null>(null);
  const notifiedReady = useRef(false);
  const workspaceEnabled = Boolean(input.workspacePath && input.workspacePath !== 'chưa có dự án');

  useEffect(() => {
    let cancelled = false;
    if (!AgentBridge.isAvailable || !workspaceEnabled) {
      setHistoryLoaded(true); setLoadedWorkspace(input.workspacePath ?? null);
      return () => { cancelled = true; };
    }
    setHistoryLoaded(false); setLoadedWorkspace(null);
    void AgentBridge.loadChatHistory().then((history) => {
      if (cancelled) return;
      const pendingThreadId = useAppStore.getState().pendingWorkspaceThreadId;
      const requestedThreadId = pendingThreadId
        && history.threads.some((thread) => thread.id === pendingThreadId)
        ? pendingThreadId
        : history.activeThreadId;
      replaceChatHistory(history.threads, requestedThreadId);
      requestWorkspaceThread(null);
      setHistoryLoaded(true); setLoadedWorkspace(input.workspacePath ?? null);
    }).catch((error) => {
      console.error('Failed to load workspace chat history', error);
      if (!cancelled) {
        replaceChatHistory([], null);
        requestWorkspaceThread(null);
        setHistoryLoaded(true); setLoadedWorkspace(input.workspacePath ?? null);
      }
    });
    return () => { cancelled = true; };
  }, [input.workspacePath, replaceChatHistory, requestWorkspaceThread, workspaceEnabled]);

  const startupReady = input.settingsLoaded && (!workspaceEnabled || loadedWorkspace === input.workspacePath);
  useEffect(() => {
    if (!startupReady || notifiedReady.current || !AgentBridge.isAvailable) return;
    notifiedReady.current = true;
    AgentBridge.notifyRendererReady();
  }, [startupReady]);

  useEffect(() => {
    if (!historyLoaded || !AgentBridge.isAvailable || !workspaceEnabled) return;
    const timeoutId = window.setTimeout(() => {
      void AgentBridge.saveChatHistory({
        threads: projectChatHistory(input.threads), activeThreadId: input.activeThreadId,
      }).catch((error) => console.error('Failed to save workspace chat history', error));
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [historyLoaded, input.activeThreadId, input.threads, workspaceEnabled]);

  return { bridgeAvailable: AgentBridge.isAvailable };
}
