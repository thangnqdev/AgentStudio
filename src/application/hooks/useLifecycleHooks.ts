import { useEffect, useState } from 'react';
import type { LifecycleHookSummary } from '../../domain/entities/lifecycleHook';
import { LifecycleHookBridge } from '../../infrastructure/ipc/lifecycleHookBridge';

export function useLifecycleHooks(active: boolean) {
  const [hooks, setHooks] = useState<LifecycleHookSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!active) return () => { cancelled = true; };
    setLoading(true); setError('');
    LifecycleHookBridge.list()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) throw new Error(result.error);
        setHooks(result.data);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể tải hooks.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active]);

  return { hooks, loading, error };
}
