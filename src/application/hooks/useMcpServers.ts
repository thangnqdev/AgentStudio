import { useCallback, useEffect, useState } from 'react';
import type { McpServerStatus, SaveMcpServerPayload } from '../../domain/entities/mcp';
import { CapabilityBridge } from '../../infrastructure/ipc/capabilityBridge';
import type { IpcResult } from '../../types/electron';

function unwrap<T>(result: IpcResult<T>) {
  if ('error' in result) throw new Error(result.error);
  return result.data;
}

export function useMcpServers() {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const run = async (task: () => Promise<IpcResult<McpServerStatus[]>>) => {
    try { setError(''); setServers(unwrap(await task())); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'MCP operation failed.'); throw reason; }
  };
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setServers(unwrap(await CapabilityBridge.listMcpServers())); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải MCP servers.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!servers.some((server) => server.state === 'needs-auth')) return;
    const interval = window.setInterval(() => { void refresh(); }, 2_000);
    return () => window.clearInterval(interval);
  }, [refresh, servers]);
  return {
    servers, error, loading, refresh,
    save: (payload: SaveMcpServerPayload) => run(() => CapabilityBridge.saveMcpServer(payload)),
    remove: (id: string) => run(() => CapabilityBridge.removeMcpServer(id)),
    start: (id: string) => run(() => CapabilityBridge.startMcpServer(id)),
    stop: (id: string) => run(() => CapabilityBridge.stopMcpServer(id)),
    authenticate: async (id: string) => {
      try { setError(''); unwrap(await CapabilityBridge.authenticateMcpServer(id)); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'MCP authentication failed.'); throw reason; }
    },
  };
}
