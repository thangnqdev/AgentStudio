import { ipcMain } from 'electron';
import { capabilityRecommender, capabilityRegistry } from '../capabilityRuntime.js';
import type { CapabilityKind, CapabilityRecommendationRequest } from '../domain/entities/capability.js';
import type { ToolRisk } from '../domain/entities/tool.js';

const KINDS: CapabilityKind[] = ['local_tool', 'mcp_tool', 'knowledge_retrieval', 'skill', 'web_search', 'terminal'];
const RISKS: ToolRisk[] = ['read', 'network', 'write', 'execute'];

function respond<T>(task: () => Promise<T>) {
  return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({ success: false as const, error: error instanceof Error ? error.message : 'Capability operation failed.' }));
}

export function registerCapabilityIpc() {
  ipcMain.handle('capabilities:list', () => respond(() => capabilityRegistry.list()));
  ipcMain.handle('capabilities:recommend', (_event, rawRequest: unknown) => respond(() => capabilityRecommender.execute(readRequest(rawRequest))));
}

function readRequest(value: unknown): CapabilityRecommendationRequest {
  if (!isObject(value)) throw new Error('Capability recommendation request must be an object.');
  const request: CapabilityRecommendationRequest = {};
  if (value.kinds !== undefined) {
    if (!Array.isArray(value.kinds) || value.kinds.some((kind) => typeof kind !== 'string' || !KINDS.includes(kind as CapabilityKind))) throw new Error('Capability kinds are invalid.');
    request.kinds = [...new Set(value.kinds as CapabilityKind[])];
  }
  if (value.maximumRisk !== undefined) {
    if (typeof value.maximumRisk !== 'string' || !RISKS.includes(value.maximumRisk as ToolRisk)) throw new Error('maximumRisk is invalid.');
    request.maximumRisk = value.maximumRisk as ToolRisk;
  }
  if (value.preferLowCost !== undefined) {
    if (typeof value.preferLowCost !== 'boolean') throw new Error('preferLowCost must be boolean.');
    request.preferLowCost = value.preferLowCost;
  }
  if (value.limit !== undefined) {
    if (typeof value.limit !== 'number' || !Number.isInteger(value.limit) || value.limit < 1 || value.limit > 20) throw new Error('limit must be an integer from 1 to 20.');
    request.limit = value.limit;
  }
  return request;
}

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
