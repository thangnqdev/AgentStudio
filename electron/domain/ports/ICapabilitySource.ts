import type { CapabilityDescriptor } from '../entities/capability.js';

export interface ICapabilitySource { list(): Promise<CapabilityDescriptor[]>; }
