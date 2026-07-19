import '@xterm/xterm/css/xterm.css';
import { useCommandShells } from '../application/hooks/useCommandShells';
import { useTerminalSession } from '../application/hooks/useTerminalSession';
import { useAppStore } from '../store/useAppStore';

export function TerminalView({ compact = false }: { compact?: boolean }) {
  const workspacePath = useAppStore((state) => state.settings.workspacePath);
  const { shells, selectedShellId, setSelectedShellId } = useCommandShells();
  const { containerRef, session, restart } = useTerminalSession(selectedShellId, shells);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#141312]">
      <div className={`${compact ? 'h-10 gap-2 px-3' : 'h-12 gap-3 px-5'} flex shrink-0 items-center border-b border-white/10 bg-[#1c1a19]`}>
        <span className="material-symbols-outlined text-[17px] text-white/75">terminal</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><span className={`${session ? 'bg-green-400' : 'animate-pulse bg-orange-300'} h-1.5 w-1.5 rounded-full`} /><span className={`${compact ? 'text-[11px]' : 'text-[13px]'} font-ui-label-bold text-white`}>Dòng lệnh</span></div>
          {!compact && <div className="truncate font-code-base text-[11px] text-white/45">{session ? `${session.shellLabel} · ${session.shell} · ${session.cwd}` : workspacePath}</div>}
        </div>
        <select value={selectedShellId} onChange={(event) => setSelectedShellId(event.target.value)} className={`${compact ? 'h-7 max-w-[120px] text-[10px]' : 'h-8 max-w-[220px] text-[12px]'} rounded border border-white/10 bg-[#141312] px-2 text-white/80 outline-none hover:bg-white/10`} title="Chọn trình lệnh">
          {shells.length === 0 ? <option value="">Đang dò...</option> : shells.map((shell) => <option key={shell.id} value={shell.id}>{shell.label}</option>)}
        </select>
        <button type="button" onClick={restart} className={`${compact ? 'flex h-7 w-7 items-center justify-center' : 'h-8 px-3 text-[12px]'} rounded border border-white/10 text-white/75 hover:bg-white/10`} title="Khởi động lại phiên này">
          {compact ? <span className="material-symbols-outlined text-[15px]">refresh</span> : 'Khởi động lại'}
        </button>
      </div>
      <div ref={containerRef} className={`${compact ? 'p-2' : 'p-3'} min-h-0 flex-1 overflow-hidden`} />
    </div>
  );
}
