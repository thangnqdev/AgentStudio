import { useCallback, useEffect, useState } from 'react';
import type { AgentTraceSummary } from '../../domain/entities/agentTrace';
import type { SkillCandidate } from '../../domain/entities/skillLearning';
import { SkillLearningBridge } from '../../infrastructure/ipc/skillLearningBridge';
import { TraceBridge } from '../../infrastructure/ipc/traceBridge';

function unwrap<T>(result: { success: true; data: T } | { success: false; error: string }) { if (!result.success) throw new Error(result.error); return result.data; }
export function useSkillLearning() {
  const [candidates, setCandidates] = useState<SkillCandidate[]>([]); const [traces, setTraces] = useState<AgentTraceSummary[]>([]); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { try { const [nextCandidates, nextTraces] = await Promise.all([SkillLearningBridge.list(), TraceBridge.list(100)]); setCandidates(unwrap(nextCandidates)); setTraces(unwrap(nextTraces).filter((trace) => trace.status === 'succeeded')); setNotice(''); } catch (error) { setNotice(message(error)); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const run = async (operation: () => Promise<unknown>) => { setBusy(true); try { await operation(); await refresh(); } catch (error) { setNotice(message(error)); } finally { setBusy(false); } };
  return { candidates, traces, notice, busy, refresh, create: (id: string) => run(() => SkillLearningBridge.create(id)), evaluate: (id: string) => run(() => SkillLearningBridge.evaluate(id)), decide: (id: string, approved: boolean) => run(() => SkillLearningBridge.decide(id, approved)), promote: (id: string) => run(() => SkillLearningBridge.promote(id)) };
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Không thể thực hiện skill learning operation.'; }
