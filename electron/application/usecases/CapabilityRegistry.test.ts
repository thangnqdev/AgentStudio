import { describe, expect, it } from 'vitest';
import type { CapabilityDescriptor, CapabilityMetrics } from '../../domain/entities/capability.js';
import type { ICapabilityMetricsProvider } from '../../domain/ports/ICapabilityMetricsProvider.js';
import type { ICapabilitySource } from '../../domain/ports/ICapabilitySource.js';
import { CapabilityRegistry } from './CapabilityRegistry.js';
import { RecommendCapabilities } from './RecommendCapabilities.js';

const descriptors: CapabilityDescriptor[] = [
  { id: 'tool:read', name: 'Read', description: 'Read', kind: 'local_tool', risk: 'read', available: true, costEstimate: { value: 0, unit: 'usd_per_call', confidence: 'local-zero' }, sourceId: 'local' },
  { id: 'tool:write', name: 'Write', description: 'Write', kind: 'local_tool', risk: 'write', available: true, costEstimate: { value: 0, unit: 'usd_per_call', confidence: 'local-zero' }, sourceId: 'local' },
  { id: 'skill:off', name: 'Off', description: 'Off', kind: 'skill', risk: 'read', available: false, costEstimate: { value: 0, unit: 'usd_per_call', confidence: 'local-zero' }, sourceId: 'skills' },
];

describe('CapabilityRegistry and advisory router', () => {
  it('merges sources with observed or explicit empty metrics', async () => {
    const registry = new CapabilityRegistry([source(descriptors)], metrics(new Map([['tool:read', observed(0.9)]])));
    const result = await registry.list();
    expect(result.find((item) => item.id === 'tool:read')?.metrics.successRate).toBe(0.9);
    expect(result.find((item) => item.id === 'tool:write')?.metrics).toMatchObject({ sampleCount: 0, successRate: null });
  });

  it('rejects duplicate stable ids across sources', async () => {
    const registry = new CapabilityRegistry([source([descriptors[0]]), source([descriptors[0]])], metrics(new Map()));
    await expect(registry.list()).rejects.toThrow('Duplicate capability id');
  });

  it('only recommends available capabilities within requested risk', async () => {
    const registry = new CapabilityRegistry([source(descriptors)], metrics(new Map()));
    const recommendation = await new RecommendCapabilities(registry).execute({ maximumRisk: 'read', preferLowCost: true });
    expect(recommendation).toEqual([expect.objectContaining({ capabilityId: 'tool:read', rank: 1, advisoryOnly: true })]);
    expect(recommendation[0]).not.toHaveProperty('arguments');
    expect(recommendation[0]).not.toHaveProperty('permissionMode');
  });
});

function source(values: CapabilityDescriptor[]): ICapabilitySource { return { list: async () => values }; }
function metrics(values: Map<string, CapabilityMetrics>): ICapabilityMetricsProvider { return { getMetrics: async () => values }; }
function observed(successRate: number): CapabilityMetrics { return { sampleCount: 10, successRate, meanLatencyMs: 20, p95LatencyMs: 30, failureTypes: { execution_error: 1 } }; }
