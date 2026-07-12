import { useCallback, useEffect, useState } from 'react';
import type { CapabilityRecommendation, CapabilitySnapshot } from '../../domain/entities/capability';
import { CapabilityBridge } from '../../infrastructure/ipc/capabilityBridge';

function unwrap<T>(result: { success: true; data: T } | { success: false; error: string }) {
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<CapabilitySnapshot[]>([]);
  const [recommendations, setRecommendations] = useState<CapabilityRecommendation[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [items, suggested] = await Promise.all([
        CapabilityBridge.list(),
        CapabilityBridge.recommend({ preferLowCost: true, limit: 8 }),
      ]);
      setCapabilities(unwrap(items));
      setRecommendations(unwrap(suggested));
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể tải capability registry.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { capabilities, recommendations, notice, loading, refresh };
}
