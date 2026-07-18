import type { PermissionMode } from '../entities/agent.js';

export type AgentAmbientContextRequest = {
  requestId: string;
  permissionMode: PermissionMode;
};

export interface IAgentAmbientContextSource {
  drain(workspaceRoot: string, request: AgentAmbientContextRequest): string | Promise<string>;
}
