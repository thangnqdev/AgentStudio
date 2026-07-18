import type { AgentToolDefinition } from '../entities/tool.js';

export interface IToolPlatformDecorator {
  decorateTools(tools: AgentToolDefinition[]): AgentToolDefinition[];
  interceptsTool(toolName: string, args: Record<string, unknown>): boolean;
}
