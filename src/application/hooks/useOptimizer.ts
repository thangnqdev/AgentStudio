import { useCallback, useEffect, useState } from 'react';
import type { OptimizerState, RuntimeOptimizationConfig } from '../../domain/entities/optimizer';
import { OptimizerBridge } from '../../infrastructure/ipc/optimizerBridge';
import { EvaluationBridge } from '../../infrastructure/ipc/evaluationBridge';

function unwrap<T>(result: { success: true; data: T } | { success: false; error: string }) { if (!result.success) throw new Error(result.error); return result.data; }
export function useOptimizer() {
  const [state, setState] = useState<OptimizerState | null>(null); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { try { setState(unwrap(await OptimizerBridge.state())); setNotice(''); } catch (error) { setNotice(message(error)); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const run = async <T,>(operation: () => Promise<{ success: true; data: T } | { success: false; error: string }>) => {
    setBusy(true);
    try { unwrap(await operation()); await refresh(); }
    catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  };
  return {
    state, notice, busy, refresh,
    create: (changes: Partial<RuntimeOptimizationConfig>) => run(() => OptimizerBridge.create(changes)),
    evaluate: (candidateId: string, baselineRunId: string, candidateRunId: string) => run(() => OptimizerBridge.evaluate({ candidateId, baselineRunId, candidateRunId })),
    benchmark: (candidateId: string) => run(async () => {
      const baseline = unwrap(await EvaluationBridge.runGolden());
      const candidate = unwrap(await EvaluationBridge.runGolden(candidateId));
      return OptimizerBridge.evaluate({
        candidateId,
        baselineRunId: baseline.runId,
        candidateRunId: candidate.runId,
      });
    }),
    promote: (candidateId: string) => run(() => OptimizerBridge.promote(candidateId)), rollback: () => run(() => OptimizerBridge.rollback()),
  };
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Không thể thực hiện optimizer operation.'; }
