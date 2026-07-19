import { useEffect } from 'react';
import type { UtilityDockToolSurface } from '../../domain/entities/utilityDock';
import { useAppStore } from '../../store/useAppStore';

export function useUtilityDockShortcuts(openTool: (surface: UtilityDockToolSurface) => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (!['j', 'p', 't'].includes(key)) return;
      event.preventDefault();
      const state = useAppStore.getState();
      if (key === 'j') {
        const terminal = [...state.utilityDockTabs].reverse().find((tab) => tab.surface === 'terminal');
        if (terminal && state.isUtilityDockOpen && state.activeUtilityDockTabId === terminal.id) state.setUtilityDockOpen(false);
        else if (terminal) state.activateUtilityDockTab(terminal.id);
        else openTool('terminal');
      } else {
        openTool(key === 'p' ? 'files' : 'browser');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openTool]);
}
