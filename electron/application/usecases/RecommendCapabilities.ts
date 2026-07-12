import type { CapabilityRecommendation, CapabilityRecommendationRequest, CapabilitySnapshot } from '../../domain/entities/capability.js';
import type { ToolRisk } from '../../domain/entities/tool.js';
import type { CapabilityRegistry } from './CapabilityRegistry.js';

const RISK_ORDER: Record<ToolRisk, number> = { read: 0, network: 1, write: 2, execute: 3 };

export class RecommendCapabilities {
  private readonly registry: CapabilityRegistry;

  constructor(registry: CapabilityRegistry) {
    this.registry = registry;
  }
  async execute(request: CapabilityRecommendationRequest): Promise<CapabilityRecommendation[]> {
    const maximumRisk = request.maximumRisk ?? 'execute'; const limit = Math.min(Math.max(request.limit ?? 5, 1), 20);
    const candidates = (await this.registry.list()).filter((item) => item.available && RISK_ORDER[item.risk] <= RISK_ORDER[maximumRisk] && (!request.kinds?.length || request.kinds.includes(item.kind)));
    return candidates.map((capability) => score(capability, request.preferLowCost === true)).sort((left, right) => right.score - left.score || left.capabilityId.localeCompare(right.capabilityId)).slice(0, limit).map((item, index) => ({ ...item, rank: index + 1 }));
  }
}

function score(capability: CapabilitySnapshot, preferLowCost: boolean): Omit<CapabilityRecommendation, 'rank'> {
  const reasons = ['available']; let value = 0.35;
  if (capability.metrics.successRate !== null) { value += capability.metrics.successRate * 0.4; reasons.push(`success-rate:${capability.metrics.successRate.toFixed(2)}`); }
  else { value += 0.2; reasons.push('success-rate:unknown'); }
  if (capability.risk === 'read') { value += 0.15; reasons.push('read-risk'); }
  if (preferLowCost && capability.costEstimate.confidence === 'local-zero') { value += 0.1; reasons.push('local-zero-cost'); }
  if (capability.metrics.p95LatencyMs !== null && capability.metrics.p95LatencyMs < 1_000) { value += 0.05; reasons.push('p95-under-1s'); }
  return { capabilityId: capability.id, score: Math.round(Math.min(value, 1) * 10_000) / 10_000, reasons, advisoryOnly: true };
}
