import { describe, expect, it } from 'vitest';
import { assertCapabilityInvariant, type CapabilitySnapshot } from './capability.js';

const valid: CapabilitySnapshot = {
  id: 'tool:read_file', name: 'read_file', description: 'Read a file.', kind: 'local_tool', risk: 'read', available: true,
  sourceId: 'local-tools', costEstimate: { value: 0, unit: 'usd_per_call', confidence: 'local-zero' },
  metrics: { sampleCount: 1, successRate: 1, meanLatencyMs: 10, p95LatencyMs: 10, failureTypes: {} },
};

describe('capability invariants', () => {
  it('accepts a complete sanitized snapshot', () => expect(() => assertCapabilityInvariant(valid)).not.toThrow());
  it('rejects impossible cost and reliability values', () => {
    expect(() => assertCapabilityInvariant({ ...valid, costEstimate: { ...valid.costEstimate, value: -1 } })).toThrow('cost');
    expect(() => assertCapabilityInvariant({ ...valid, metrics: { ...valid.metrics, successRate: 1.1 } })).toThrow('metrics');
    expect(() => assertCapabilityInvariant({ ...valid, metrics: { ...valid.metrics, sampleCount: 0 } })).toThrow('metrics');
  });
});
