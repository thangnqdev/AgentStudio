import type { CapabilityMetrics } from '../entities/capability.js';

export interface ICapabilityMetricsProvider { getMetrics(capabilityIds: string[]): Promise<Map<string, CapabilityMetrics>>; }
