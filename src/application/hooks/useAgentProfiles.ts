import { useCallback, useEffect, useState } from 'react';
import type { AgentProfileStatus } from '../../domain/entities/agentProfile';
import { CapabilityBridge } from '../../infrastructure/ipc/capabilityBridge';

export function useAgentProfiles() {
  const [profiles, setProfiles] = useState<AgentProfileStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apply = (result: Awaited<ReturnType<typeof CapabilityBridge.listAgentProfiles>>) => {
    if (!result.success) throw new Error(result.error);
    setProfiles(result.data);
    setError('');
  };
  const refresh = useCallback(async () => {
    setLoading(true);
    try { apply(await CapabilityBridge.listAgentProfiles()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải agent profiles.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const setTrusted = async (profileId: string, value: boolean) => {
    try { apply(await CapabilityBridge.setAgentProfileTrusted({ profileId, value })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật trust.'); }
  };
  const setEnabled = async (profileId: string, value: boolean) => {
    try { apply(await CapabilityBridge.setAgentProfileEnabled({ profileId, value })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật profile.'); }
  };
  return { profiles, loading, error, refresh, setTrusted, setEnabled };
}
