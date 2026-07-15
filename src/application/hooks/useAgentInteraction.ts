import type { AgentInteractionResponse } from '../../domain/entities/agentInteraction';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';
import { useAppStore } from '../../store/useAppStore';

export function useAgentInteraction() {
  const interaction = useAppStore((state) => state.pendingInteraction);
  const setPendingInteraction = useAppStore((state) => state.setPendingInteraction);
  const setIsAgentTyping = useAppStore((state) => state.setIsAgentTyping);

  const respond = (response: AgentInteractionResponse) => {
    if (!interaction) return;
    AgentBridge.respondToAgentInteraction({
      requestId: interaction.requestId,
      interactionId: interaction.id,
      response,
    });
    setPendingInteraction(null);
    setIsAgentTyping(true);
  };

  return { interaction, respond };
}
