import type { ToolRisk } from './tool.js';

export type CapabilityKind = 'local_tool' | 'mcp_tool' | 'knowledge_retrieval' | 'skill' | 'web_search' | 'terminal';
export type CapabilityFailureType = 'blocked' | 'denied' | 'execution_error' | 'unavailable' | 'unknown';
export type CapabilityCostEstimate = { value: number | null; unit: 'usd_per_call'; confidence: 'local-zero' | 'configured' | 'unknown' };
export type CapabilityDescriptor = { id: string; name: string; description: string; kind: CapabilityKind; risk: ToolRisk; available: boolean; costEstimate: CapabilityCostEstimate; sourceId: string };
export type CapabilityMetrics = { sampleCount: number; successRate: number | null; meanLatencyMs: number | null; p95LatencyMs: number | null; failureTypes: Partial<Record<CapabilityFailureType, number>> };
export type CapabilitySnapshot = CapabilityDescriptor & { metrics: CapabilityMetrics };
export type CapabilityRecommendation = { capabilityId: string; rank: number; score: number; reasons: string[]; advisoryOnly: true };
export type CapabilityRecommendationRequest = { kinds?: CapabilityKind[]; maximumRisk?: ToolRisk; preferLowCost?: boolean; limit?: number };

export function assertCapabilityInvariant(capability: CapabilitySnapshot) {
  if (!/^[a-zA-Z0-9_.:-]{1,160}$/.test(capability.id) || !capability.name.trim() || !capability.sourceId.trim()) throw new Error('Capability identity is invalid.');
  if (!['local_tool', 'mcp_tool', 'knowledge_retrieval', 'skill', 'web_search', 'terminal'].includes(capability.kind) || !['read', 'write', 'execute', 'network'].includes(capability.risk) || typeof capability.available !== 'boolean') throw new Error('Capability classification is invalid.');
  assertCost(capability.costEstimate);
  assertMetrics(capability.metrics);
}

function assertCost(cost: CapabilityCostEstimate) {
  if (cost.unit !== 'usd_per_call' || !['local-zero', 'configured', 'unknown'].includes(cost.confidence)) throw new Error('Capability cost estimate is invalid.');
  if (cost.confidence === 'unknown' && cost.value !== null) throw new Error('Capability cost estimate is invalid.');
  if (cost.confidence === 'local-zero' && cost.value !== 0) throw new Error('Capability cost estimate is invalid.');
  if (cost.confidence === 'configured' && (cost.value === null || !Number.isFinite(cost.value) || cost.value < 0)) throw new Error('Capability cost estimate is invalid.');
}

function assertMetrics(metrics: CapabilityMetrics) {
  const latency = [metrics.meanLatencyMs, metrics.p95LatencyMs];
  if (!Number.isInteger(metrics.sampleCount) || metrics.sampleCount < 0) throw new Error('Capability metrics are invalid.');
  if (metrics.sampleCount === 0 && (metrics.successRate !== null || latency.some((value) => value !== null))) throw new Error('Capability metrics are invalid.');
  if (metrics.sampleCount > 0 && (metrics.successRate === null || latency.some((value) => value === null))) throw new Error('Capability metrics are invalid.');
  if (metrics.successRate !== null && (!Number.isFinite(metrics.successRate) || metrics.successRate < 0 || metrics.successRate > 1)) throw new Error('Capability metrics are invalid.');
  if (latency.some((value) => value !== null && (!Number.isFinite(value) || value < 0))) throw new Error('Capability metrics are invalid.');
  if (Object.values(metrics.failureTypes).some((count) => !Number.isInteger(count) || count! < 0)) throw new Error('Capability metrics are invalid.');
}
