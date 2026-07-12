import { useCallback, useEffect, useState } from 'react';
import type { AgentEvaluationReport } from '../../domain/entities/agentEvaluation';
import { EvaluationBridge } from '../../infrastructure/ipc/evaluationBridge';
import type { IpcResult } from '../../types/electron';

function unwrap<T>(result: IpcResult<T>) { if ('error' in result) throw new Error(result.error); return result.data; }

export function useAgentEvaluations() {
  const [reports, setReports] = useState<AgentEvaluationReport[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    try { setReports(unwrap(await EvaluationBridge.list())); setNotice(''); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tải evaluation reports.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const run = async () => {
    setRunning(true);
    try { const report = unwrap(await EvaluationBridge.runGolden()); setReports((current) => [report, ...current]); setNotice(report.passed ? 'Golden regression đã đạt.' : 'Golden regression thất bại.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể chạy regression.'); }
    finally { setRunning(false); }
  };
  const exportReport = async (runId: string) => {
    try { const result = unwrap(await EvaluationBridge.export(runId)); if (!result.canceled) setNotice('Đã export evaluation report.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể export report.'); }
  };
  return { reports, running, notice, refresh, run, exportReport };
}
