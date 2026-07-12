function bridge() { if (!window.agentStudio) throw new Error('Electron bridge is not available.'); return window.agentStudio; }
export const EvaluationBridge = {
  list: (limit = 50) => bridge().listAgentEvaluations(limit),
  runGolden: () => bridge().runGoldenAgentEvaluation(),
  export: (runId: string) => bridge().exportAgentEvaluation(runId),
};
