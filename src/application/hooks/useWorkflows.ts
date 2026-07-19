import { useCallback, useEffect, useState } from 'react';
import type { NodeCheckpoint, WorkflowDefinition } from '../../domain/entities/workflow';
import { WorkflowBridge } from '../../infrastructure/ipc/workflowBridge';
import type { IpcResult } from '../../types/electron';

function unwrap<T>(result: IpcResult<T>) { if ('error' in result) throw new Error(result.error); return result.data; }
export function useWorkflows() {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]); const [runs, setRuns] = useState<NodeCheckpoint[]>([]); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { try { const [nextDefinitions, nextRuns] = await Promise.all([WorkflowBridge.definitions(), WorkflowBridge.runs()]); setDefinitions(unwrap(nextDefinitions)); setRuns(unwrap(nextRuns)); setNotice(''); } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tải workflows.'); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const run = async (task: () => Promise<IpcResult<NodeCheckpoint>>) => { setBusy(true); try { const checkpoint = unwrap(await task()); setRuns((current) => [checkpoint, ...current.filter((item) => item.runId !== checkpoint.runId)]); setNotice(checkpoint.status === 'paused' ? 'Quy trình đang chờ bạn phê duyệt.' : `Quy trình: ${statusLabel(checkpoint.status)}.`); } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể chạy quy trình.'); } finally { setBusy(false); } };
  return { definitions, runs, notice, busy, refresh, start: (id: string) => run(() => WorkflowBridge.start(id)), decide: (runState: NodeCheckpoint, approved: boolean) => run(() => WorkflowBridge.resume({ workflowId: runState.workflowId, runId: runState.runId, nodeId: runState.currentNodeId || '', approved })) };
}

function statusLabel(status: NodeCheckpoint['status']) {
  return ({ running: 'đang chạy', paused: 'tạm dừng', completed: 'đã hoàn tất', failed: 'gặp lỗi' } as const)[status];
}
