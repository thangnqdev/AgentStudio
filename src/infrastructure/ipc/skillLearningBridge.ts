function bridge() { if (!window.agentStudio) throw new Error('Electron bridge is not available.'); return window.agentStudio; }
export const SkillLearningBridge = {
  list: () => bridge().listSkillCandidates(), create: (traceId: string) => bridge().createSkillCandidate(traceId),
  evaluate: (candidateId: string) => bridge().evaluateSkillCandidate(candidateId), decide: (candidateId: string, approved: boolean) => bridge().decideSkillCandidate({ candidateId, approved }),
  promote: (candidateId: string) => bridge().promoteSkillCandidate(candidateId),
};
