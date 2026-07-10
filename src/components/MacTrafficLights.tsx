import { useEffect, useState } from 'react';
import { AgentBridge } from '../infrastructure/ipc/agentStudioBridge';

export function MacTrafficLights() {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    // Only show custom buttons if the platform is not macOS (darwin)
    // On macOS, Electron provides native traffic lights when titleBarStyle is 'hidden'
    if (AgentBridge.isAvailable) {
      setIsMac(AgentBridge.getPlatform() === 'darwin');
    } else {
      // Fallback if IPC isn't available
      setIsMac(window.navigator.userAgent.toLowerCase().includes('mac'));
    }
  }, []);

  if (isMac) {
    return null;
  }

  const handleClose = () => AgentBridge.closeWindow();
  const handleMinimize = () => AgentBridge.minimizeWindow();
  const handleMaximize = () => AgentBridge.maximizeWindow();

  return (
    <div className="flex items-center gap-2 px-4 h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
      <button
        onClick={handleClose}
        className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 flex items-center justify-center group"
        title="Đóng"
      >
        <svg className="opacity-0 group-hover:opacity-100 w-2 h-2 text-black/60" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 2 L8 8 M8 2 L2 8" />
        </svg>
      </button>
      <button
        onClick={handleMinimize}
        className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffbd2e]/80 flex items-center justify-center group"
        title="Thu nhỏ"
      >
        <svg className="opacity-0 group-hover:opacity-100 w-2 h-2 text-black/60" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 5 L8 5" />
        </svg>
      </button>
      <button
        onClick={handleMaximize}
        className="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#27c93f]/80 flex items-center justify-center group"
        title="Phóng to"
      >
        <svg className="opacity-0 group-hover:opacity-100 w-[7px] h-[7px] text-black/60" viewBox="0 0 10 10" fill="currentColor">
          <path d="M1,1 L5.5,1 L1,5.5 Z" />
          <path d="M9,9 L4.5,9 L9,4.5 Z" />
        </svg>
      </button>
    </div>
  );
}
