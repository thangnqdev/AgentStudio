import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';

export function useGitStatus() {
  const projectPath = useAppStore((s) => s.projectPath);
  const setCurrentBranch = useAppStore((s) => s.setCurrentBranch);
  const currentBranch = useAppStore((s) => s.currentBranch);

  useEffect(() => {
    if (!projectPath || projectPath === 'chưa có dự án' || !AgentBridge.isAvailable) {
      setCurrentBranch(null);
      return;
    }

    let isMounted = true;
    AgentBridge.getGitBranch()
      .then((branch) => {
        if (isMounted) {
          setCurrentBranch(branch || null);
        }
      })
      .catch(() => {
        if (isMounted) setCurrentBranch(null);
      });

    return () => {
      isMounted = false;
    };
  }, [projectPath, setCurrentBranch]);

  return { currentBranch };
}
