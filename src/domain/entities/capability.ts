export type CapabilityKind = 'local_tool' | 'mcp_tool' | 'knowledge_retrieval' | 'skill' | 'web_search' | 'terminal';
export type CapabilitySnapshot = {
  id: string;
  name: string;
  description: string;
  kind: CapabilityKind;
  risk: 'read' | 'write' | 'execute' | 'network';
  available: boolean;
  costEstimate: { value: number | null; unit: 'usd_per_call'; confidence: 'local-zero' | 'configured' | 'unknown' };
  sourceId: string;
  metrics: { sampleCount: number; successRate: number | null; meanLatencyMs: number | null; p95LatencyMs: number | null; failureTypes: Partial<Record<'blocked' | 'denied' | 'execution_error' | 'unavailable' | 'unknown', number>> };
};
export type CapabilityRecommendation = { capabilityId: string; rank: number; score: number; reasons: string[]; advisoryOnly: true };
export type CapabilityRecommendationRequest = { kinds?: CapabilityKind[]; maximumRisk?: CapabilitySnapshot['risk']; preferLowCost?: boolean; limit?: number };
