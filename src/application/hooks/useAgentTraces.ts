import { useCallback, useEffect, useState } from 'react';
import type { AgentTraceDetails, AgentTraceSummary } from '../../domain/entities/agentTrace';
import { TraceBridge } from '../../infrastructure/ipc/traceBridge';
import type { IpcResult } from '../../types/electron';

function unwrap<T>(result: IpcResult<T>) {
  if ('error' in result) throw new Error(result.error);
  return result.data;
}

export function useAgentTraces() {
  const [traces, setTraces] = useState<AgentTraceSummary[]>([]);
  const [details, setDetails] = useState<AgentTraceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = unwrap(await TraceBridge.list());
      setTraces(next);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể tải traces.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const select = async (traceId: string) => {
    try { setDetails(unwrap(await TraceBridge.get(traceId))); setNotice(''); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tải trace.'); }
  };
  const exportTrace = async (traceId: string) => {
    try {
      const result = unwrap(await TraceBridge.export(traceId));
      if (!result.canceled) setNotice(`Đã export ${result.recordCount} JSONL records.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể export trace.'); }
  };
  return { traces, details, loading, notice, refresh, select, exportTrace };
}
