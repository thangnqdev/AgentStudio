import { assertCapabilityInvariant, type CapabilityMetrics, type CapabilitySnapshot } from '../../domain/entities/capability.js';
import type { ICapabilityMetricsProvider } from '../../domain/ports/ICapabilityMetricsProvider.js';
import type { ICapabilitySource } from '../../domain/ports/ICapabilitySource.js';

const EMPTY_METRICS: CapabilityMetrics = { sampleCount: 0, successRate: null, meanLatencyMs: null, p95LatencyMs: null, failureTypes: {} };

export class CapabilityRegistry {
  private readonly sources: ICapabilitySource[];
  private readonly metrics: ICapabilityMetricsProvider;

  constructor(sources: ICapabilitySource[], metrics: ICapabilityMetricsProvider) {
    this.sources = sources;
    this.metrics = metrics;
  }
  async list() {
    const descriptors = (await Promise.all(this.sources.map((source) => source.list()))).flat();
    const ids = new Set<string>();
    for (const descriptor of descriptors) { if (ids.has(descriptor.id)) throw new Error(`Duplicate capability id: ${descriptor.id}`); ids.add(descriptor.id); }
    const metrics = await this.metrics.getMetrics([...ids]);
    return descriptors.map((descriptor): CapabilitySnapshot => {
      const snapshot = { ...descriptor, metrics: metrics.get(descriptor.id) ?? { ...EMPTY_METRICS, failureTypes: {} } };
      assertCapabilityInvariant(snapshot); return snapshot;
    }).sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
  }
}
