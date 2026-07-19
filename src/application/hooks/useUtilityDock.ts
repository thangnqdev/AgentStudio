import { useCallback } from 'react';
import type { AgentControlParticipant } from '../services/agentControlCenter';
import { nextTerminalTitle, utilityDockSurfaceTitle } from '../services/utilityDockTabs';
import type { UtilityDockToolSurface } from '../../domain/entities/utilityDock';
import { useAppStore } from '../../store/useAppStore';

export function useUtilityDock() {
  const tabs = useAppStore((state) => state.utilityDockTabs);
  const openTab = useAppStore((state) => state.openUtilityDockTab);
  const activateTab = useAppStore((state) => state.activateUtilityDockTab);

  const openActivity = useCallback(() => activateTab('utility:activity'), [activateTab]);
  const openTool = useCallback((surface: UtilityDockToolSurface) => {
    return openTab({
      surface,
      title: surface === 'terminal' ? nextTerminalTitle(tabs) : utilityDockSurfaceTitle(surface),
      ...(surface === 'terminal' ? {} : { reuseKey: surface }),
    });
  }, [openTab, tabs]);
  const openAgent = useCallback((participant: AgentControlParticipant) => openTab({
    surface: 'agent',
    title: participant.name,
    agentId: participant.id,
    reuseKey: `agent:${participant.id}`,
  }), [openTab]);

  return { openActivity, openTool, openAgent };
}
