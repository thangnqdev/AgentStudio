import { useEffect, useRef, useState } from 'react';
import type { CommandShell, TerminalSession } from '../../domain/entities/terminalSession';
import { createBrowserTerminal } from '../../infrastructure/terminal/createBrowserTerminal';
import { TerminalOutputBuffer } from '../services/TerminalOutputBuffer';
import { useTerminalBridge } from './useTerminalBridge';

export function useTerminalSession(selectedShellId: string, shells: CommandShell[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const bridge = useTerminalBridge();

  useEffect(() => {
    const container = containerRef.current;
    if (!bridge || !container || !selectedShellId) return;
    let disposed = false;
    let resizeFrame = 0;
    const { terminal, fitAddon } = createBrowserTerminal(container);
    const outputBuffer = new TerminalOutputBuffer();
    const selectedShell = shells.find((shell) => shell.id === selectedShellId);
    terminal.writeln(`\x1b[38;5;244mĐang khởi tạo${selectedShell ? `: ${selectedShell.label}` : ''}...\x1b[0m`);

    const fitAndResize = () => {
      if (disposed) return;
      try {
        fitAddon.fit();
        const terminalId = terminalIdRef.current;
        if (terminalId) bridge.resizeTerminal({ terminalId, cols: terminal.cols, rows: terminal.rows });
      } catch {
        // The dock can be between collapsed and expanded layouts for one frame.
      }
    };
    const scheduleFit = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(fitAndResize);
    };
    scheduleFit();
    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(container);
    const inputSubscription = terminal.onData((data) => {
      const terminalId = terminalIdRef.current;
      if (terminalId) bridge.writeTerminal({ terminalId, data });
    });
    const cleanupData = bridge.onTerminalData((payload) => {
      const data = outputBuffer.accept(payload, terminalIdRef.current);
      if (data) terminal.write(data);
    });
    const cleanupExit = bridge.onTerminalExit((payload) => {
      if (payload.terminalId !== terminalIdRef.current) return;
      terminal.writeln('');
      terminal.writeln(`\x1b[38;5;244mPhiên đã kết thúc với mã ${payload.exitCode ?? 'không xác định'}.\x1b[0m`);
      terminalIdRef.current = null;
      setSession(null);
    });

    bridge.createTerminal({ cols: terminal.cols, rows: terminal.rows, shellId: selectedShellId })
      .then((created) => {
        if (disposed) { bridge.killTerminal(created.terminalId); return; }
        terminalIdRef.current = created.terminalId;
        setSession(created);
        for (const data of outputBuffer.drain(created.terminalId)) terminal.write(data);
        bridge.writeTerminal({ terminalId: created.terminalId, data: '\r' });
        scheduleFit();
        terminal.focus();
      })
      .catch((error) => terminal.writeln(`\x1b[31mKhông mở được dòng lệnh: ${error instanceof Error ? error.message : String(error)}\x1b[0m`));

    return () => {
      disposed = true;
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      inputSubscription.dispose();
      cleanupData();
      cleanupExit();
      const terminalId = terminalIdRef.current;
      if (terminalId) bridge.killTerminal(terminalId);
      terminalIdRef.current = null;
      terminal.dispose();
    };
  }, [bridge, restartKey, selectedShellId, shells]);

  return { containerRef, session, restart: () => setRestartKey((value) => value + 1) };
}
