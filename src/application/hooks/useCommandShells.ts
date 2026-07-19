import { useEffect, useState } from 'react';
import type { CommandShell } from '../../domain/entities/terminalSession';
import { useTerminalBridge } from './useTerminalBridge';

export function useCommandShells() {
  const [shells, setShells] = useState<CommandShell[]>([]);
  const [selectedShellId, setSelectedShellId] = useState('');
  const terminalBridge = useTerminalBridge();

  useEffect(() => {
    if (!terminalBridge) return;
    let disposed = false;
    terminalBridge.listCommandShells()
      .then((available) => {
        if (disposed) return;
        setShells(available);
        setSelectedShellId((current) => current || available[0]?.id || '');
      })
      .catch(() => { if (!disposed) setShells([]); });
    return () => { disposed = true; };
  }, [terminalBridge]);

  return { shells, selectedShellId, setSelectedShellId };
}
