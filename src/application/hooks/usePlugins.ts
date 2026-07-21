import { useCallback, useEffect, useState } from 'react';
import type { PluginStatus } from '../../domain/entities/plugin';
import { PluginBridge } from '../../infrastructure/ipc/pluginBridge';

export function usePlugins() {
  const [plugins, setPlugins] = useState<PluginStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apply = (result: Awaited<ReturnType<typeof PluginBridge.list>>) => {
    if (!result.success) throw new Error(result.error);
    setPlugins(result.data);
    setError('');
  };
  const refresh = useCallback(async () => {
    setLoading(true);
    try { apply(await PluginBridge.list()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải plugins.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const setTrusted = async (pluginId: string, value: boolean) => {
    try { apply(await PluginBridge.setTrusted({ pluginId, value })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật trust.'); }
  };
  const setEnabled = async (pluginId: string, value: boolean) => {
    try { apply(await PluginBridge.setEnabled({ pluginId, value })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật plugin.'); }
  };
  const install = async () => {
    try { apply(await PluginBridge.install()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể nhập plugin.'); }
  };
  const remove = async (pluginId: string) => {
    try { apply(await PluginBridge.remove(pluginId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể xóa plugin.'); }
  };
  return { plugins, loading, error, refresh, setTrusted, setEnabled, install, remove };
}
