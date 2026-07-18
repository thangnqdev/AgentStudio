import { useEffect, useState } from 'react';
import type { ResumableTask } from '../../domain/entities/agentTask';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';

export function useResumableTasks(active: boolean) {
  const [tasks, setTasks] = useState<ResumableTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!active) return () => { cancelled = true; };
    setTasks([]);
    setLoading(true);
    setError('');
    AgentBridge.listResumableAgentTasks()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) throw new Error(result.error);
        setTasks(result.tasks.flatMap((task) => task.status === 'paused' || task.status === 'failed' ? [{
          id: task.id, title: task.title, status: task.status,
          completedSteps: task.completedSteps, updatedAt: task.updatedAt, lastError: task.lastError,
          parentTaskId: task.parentTaskId, branchDepth: task.branchDepth,
        }] : []));
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể tải task.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active]);

  return { tasks, loading, error };
}
