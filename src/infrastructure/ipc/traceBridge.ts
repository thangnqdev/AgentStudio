function bridge() {
  if (!window.agentStudio) throw new Error('Electron bridge is not available.');
  return window.agentStudio;
}

export const TraceBridge = {
  list: (limit = 100) => bridge().listAgentTraces(limit),
  get: (traceId: string) => bridge().getAgentTrace(traceId),
  export: (traceId: string) => bridge().exportAgentTrace(traceId),
};
