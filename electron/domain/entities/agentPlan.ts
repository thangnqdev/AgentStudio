export type AgentPlanSessionSnapshot = {
  scopeId: string;
  mode: 'default' | 'plan';
  approvedPlan?: string;
  planReference?: string;
  updatedAt: string;
};

export type SavedAgentPlan = {
  reference: string;
};

export type AgentPlanModePayload = {
  active: boolean;
};
