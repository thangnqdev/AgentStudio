import { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../store/useAppStore';

type TerminalSession = {
  terminalId: string;
  shellId: string;
  shell: string;
  shellLabel: string;
  cwd: string;
};

type CommandShell = {
  id: string;
  label: string;
  command: string;
};

export function TerminalView() {
  const workspacePath = useAppStore((s) => s.settings.workspacePath);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [shells, setShells] = useState<CommandShell[]>([]);
  const [selectedShellId, setSelectedShellId] = useState('');
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    const bridge = window.agentStudio;
    if (!bridge) return;

    let disposed = false;
    bridge.listCommandShells()
      .then((availableShells) => {
        if (disposed) return;
        setShells(availableShells);
        setSelectedShellId((current) => current || availableShells[0]?.id || '');
      })
      .catch(() => {
        if (!disposed) {
          setShells([]);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const bridge = window.agentStudio;
    const container = containerRef.current;
    if (!bridge || !container || !selectedShellId) return;

    let disposed = false;
    let resizeFrame = 0;
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 8000,
      convertEol: true,
      theme: {
        background: '#141312',
        foreground: '#f4f0ee',
        cursor: '#f4f0ee',
        selectionBackground: '#8f4a2d66',
        black: '#211f1e',
        red: '#ff6b5f',
        green: '#7bd88f',
        yellow: '#f7d774',
        blue: '#82aaff',
        magenta: '#c792ea',
        cyan: '#89ddff',
        white: '#f4f0ee',
        brightBlack: '#6f6a67',
        brightRed: '#ff8a80',
        brightGreen: '#a5e8b5',
        brightYellow: '#ffe59a',
        brightBlue: '#a6c8ff',
        brightMagenta: '#d7aefb',
        brightCyan: '#b2ebff',
        brightWhite: '#ffffff',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    const selectedShell = shells.find((shell) => shell.id === selectedShellId);
    terminal.writeln(`\x1b[38;5;244mĐang khởi tạo trình lệnh${selectedShell ? `: ${selectedShell.label}` : ''}...\x1b[0m`);

    const fitAndResize = () => {
      if (disposed) return;
      try {
        fitAddon.fit();
        const terminalId = terminalIdRef.current;
        if (terminalId) {
          bridge.resizeTerminal({ terminalId, cols: terminal.cols, rows: terminal.rows });
        }
      } catch {
        // Fit can fail briefly while the container is being laid out.
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
      if (terminalId) {
        bridge.writeTerminal({ terminalId, data });
      }
    });

    const cleanupData = bridge.onTerminalData((payload) => {
      if (payload.terminalId === terminalIdRef.current && payload.data) {
        terminal.write(payload.data);
      }
    });
    const cleanupExit = bridge.onTerminalExit((payload) => {
      if (payload.terminalId !== terminalIdRef.current) return;
      terminal.writeln('');
      terminal.writeln(`\x1b[38;5;244mTerminal đã thoát với mã ${payload.exitCode ?? 'unknown'}.\x1b[0m`);
      terminalIdRef.current = null;
      setSession(null);
    });

    bridge.createTerminal({ cols: terminal.cols, rows: terminal.rows, shellId: selectedShellId })
      .then((createdSession) => {
        if (disposed) {
          bridge.killTerminal(createdSession.terminalId);
          return;
        }
        terminalIdRef.current = createdSession.terminalId;
        setSession(createdSession);
        scheduleFit();
        terminal.focus();
      })
      .catch((error) => {
        terminal.writeln(`\x1b[31mKhông khởi tạo được terminal: ${error instanceof Error ? error.message : String(error)}\x1b[0m`);
      });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      inputSubscription.dispose();
      cleanupData();
      cleanupExit();
      const terminalId = terminalIdRef.current;
      if (terminalId) {
        bridge.killTerminal(terminalId);
      }
      terminalIdRef.current = null;
      terminal.dispose();
    };
  }, [restartKey, selectedShellId, shells]);

  const handleShellChange = (shellId: string) => {
    setSelectedShellId(shellId);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#141312]">
      <div className="h-12 shrink-0 border-b border-white/10 bg-[#1c1a19] px-5 flex items-center gap-3">
        <span className="material-symbols-outlined text-[18px] text-white/75">terminal</span>
        <div className="min-w-0 flex-1">
          <div className="font-ui-label-bold text-[13px] text-white">Trình lệnh hệ thống</div>
          <div className="font-code-base text-[11px] text-white/45 truncate">
            {session ? `${session.shellLabel} · ${session.shell} · ${session.cwd}` : workspacePath}
          </div>
        </div>
        <select
          value={selectedShellId}
          onChange={(event) => handleShellChange(event.target.value)}
          className="h-8 max-w-[220px] rounded border border-white/10 bg-[#141312] px-2 text-[12px] text-white/80 outline-none hover:bg-white/10"
          title="Chọn trình lệnh hệ thống"
        >
          {shells.length === 0 ? (
            <option value="">Đang dò shell...</option>
          ) : shells.map((shell) => (
            <option key={shell.id} value={shell.id}>
              {shell.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setRestartKey((value) => value + 1)}
          className="h-8 px-3 rounded border border-white/10 text-[12px] text-white/75 hover:bg-white/10"
        >
          Khởi động lại
        </button>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 p-3 overflow-hidden" />
    </div>
  );
}
