import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceProjectSummary } from '../../domain/entities/workspaceProject';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';
import { useAppStore } from '../../store/useAppStore';
import { projectChatHistory } from '../services/chatHistoryProjection';
import { useWindowControls } from './useWindowControls';

export function useWorkspaceProjects() {
  const [projects, setProjects] = useState<WorkspaceProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { selectWorkspace } = useWindowControls();
  const setProjectPath = useAppStore((state) => state.setProjectPath);
  const setSettings = useAppStore((state) => state.setSettings);
  const switchThread = useAppStore((state) => state.switchThread);
  const requestWorkspaceThread = useAppStore((state) => state.requestWorkspaceThread);

  const refresh = useCallback(async () => {
    if (!AgentBridge.isAvailable) { setLoading(false); return; }
    setLoading(true);
    try {
      setProjects(await AgentBridge.listWorkspaceProjects());
      setError('');
    } catch (cause) {
      setError(errorMessage(cause, 'Không thể tải danh sách dự án.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const addProject = async () => {
    if (hasRunningAgent()) { setError(runningAgentMessage()); return; }
    try {
      const selected = await selectWorkspace();
      if (!selected?.canceled) await refresh();
      setError('');
    } catch (cause) {
      setError(errorMessage(cause, 'Không thể thêm dự án.'));
    }
  };

  const openProject = async (project: WorkspaceProjectSummary, threadId?: string) => {
    const state = useAppStore.getState();
    if (samePath(project.path, state.settings.workspacePath)) {
      if (threadId && threadId !== state.activeThreadId && hasRunningAgent()) {
        setError(runningAgentMessage());
        return;
      }
      if (threadId) switchThread(threadId);
      return;
    }
    if (hasRunningAgent()) { setError(runningAgentMessage()); return; }
    try {
      await saveCurrentHistory();
      const result = await AgentBridge.activateWorkspace(project.path);
      if (!result.success) throw new Error(result.error);
      requestWorkspaceThread(threadId ?? project.activeThreadId);
      setProjectPath(result.data.path);
      setSettings({
        workspacePath: result.data.path,
        recentWorkspacePaths: result.data.recentWorkspacePaths,
      });
      await refresh();
      setError('');
    } catch (cause) {
      setError(errorMessage(cause, 'Không thể chuyển dự án.'));
    }
  };

  const removeProject = async (workspacePath: string) => {
    try {
      const result = await AgentBridge.removeRecentWorkspace(workspacePath);
      if (!result.success) throw new Error(result.error);
      setProjects(result.data);
      setError('');
    } catch (cause) {
      setError(errorMessage(cause, 'Không thể ẩn dự án.'));
    }
  };

  return { projects, loading, error, refresh, addProject, openProject, removeProject };
}

async function saveCurrentHistory() {
  const state = useAppStore.getState();
  if (!state.settings.workspacePath) return;
  await AgentBridge.saveChatHistory({
    threads: projectChatHistory(state.threads),
    activeThreadId: state.activeThreadId,
  });
}

function hasRunningAgent() {
  return Boolean(useAppStore.getState().activeRequestId);
}

function runningAgentMessage() {
  return 'Agent đang chạy. Bạn vẫn có thể mở màn hình khác; hãy đợi hoặc dừng agent trước khi đổi chat/dự án.';
}

function samePath(left: string, right: string) {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}
