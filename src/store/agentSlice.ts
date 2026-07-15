import { reduceAgentAction, reduceAgentThoughtChunk } from '../application/services/agentStateReducers';
import { syncActiveThread } from '../application/services/chatThreadState';
import type { AgentSlice, AppSlice } from './appStoreTypes';

export const createAgentSlice: AppSlice<AgentSlice> = (set) => ({
  activeRequestId: null,
  agentActions: [],
  agentThoughts: [],
  agentThoughtStartsNewLine: true,
  isAgentTyping: false,
  resumableTask: null,
  pendingInteraction: null,
  planModeActive: false,
  worktreeState: { active: false },
  setActiveRequestId: (activeRequestId) => set({ activeRequestId }),
  upsertAgentAction: (action) => set((state) => {
    const { agentActions, messages } = reduceAgentAction(
      state.agentActions,
      state.messages,
      action,
    );
    return {
      agentActions,
      ...syncActiveThread(state, messages, {
        createId: () => crypto.randomUUID(),
        now: () => new Date(),
      }),
    };
  }),
  clearAgentActions: () => set({ agentActions: [] }),
  appendAgentThoughtChunk: (requestId, chunk) => set((state) => {
    const next = reduceAgentThoughtChunk(
      { thoughts: state.agentThoughts, startsNewLine: state.agentThoughtStartsNewLine },
      requestId,
      chunk,
    );
    return {
      agentThoughts: next.thoughts,
      agentThoughtStartsNewLine: next.startsNewLine,
    };
  }),
  clearAgentThoughts: () => set({
    agentThoughts: [],
    agentThoughtStartsNewLine: true,
  }),
  setIsAgentTyping: (isAgentTyping) => set({ isAgentTyping }),
  setResumableTask: (resumableTask) => set({ resumableTask }),
  setPendingInteraction: (pendingInteraction) => set({ pendingInteraction }),
  setPlanModeActive: (planModeActive) => set({ planModeActive }),
  setWorktreeState: (worktreeState) => set({ worktreeState }),
});
