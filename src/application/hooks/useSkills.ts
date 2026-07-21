import { useCallback, useEffect, useState } from 'react';
import type { SkillStatus } from '../../domain/entities/skill';
import { CapabilityBridge } from '../../infrastructure/ipc/capabilityBridge';
import type { IpcResult } from '../../types/electron';

function unwrap<T>(result: IpcResult<T>) {
  if ('error' in result) throw new Error(result.error);
  return result.data;
}

export function useSkills() {
  const [skills, setSkills] = useState<SkillStatus[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSkills(unwrap(await CapabilityBridge.listSkills()));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải skills.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const setTrusted = async (skillId: string, trusted: boolean) => {
    try { setSkills(unwrap(await CapabilityBridge.setSkillTrusted({ skillId, trusted }))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật skill.'); }
  };
  const setEnabled = async (skillId: string, enabled: boolean) => {
    try { setSkills(unwrap(await CapabilityBridge.setSkillEnabled({ skillId, enabled }))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật skill.'); }
  };

  const install = async () => {
    try { setSkills(unwrap(await CapabilityBridge.installSkill())); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể nhập skill.'); }
  };
  const remove = async (skillId: string) => {
    try { setSkills(unwrap(await CapabilityBridge.removeSkill(skillId))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể xóa skill.'); }
  };

  return { skills, error, loading, refresh, setTrusted, setEnabled, install, remove };
}
