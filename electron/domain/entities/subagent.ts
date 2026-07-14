import type { AgentToolDefinition } from './tool.js';

export const SUBAGENT_TOOL_NAME = 'delegate_task';
export const MAX_SUBAGENT_PROMPT_CHARACTERS = 12_000;
export const MAX_SUBAGENT_STEPS = 8;
export const SUBAGENT_ROLES = ['explore', 'review', 'plan'] as const;

export type SubagentRole = typeof SUBAGENT_ROLES[number];
export type SubagentRequest = { prompt: string; role: SubagentRole; agentId?: string };
export type SubagentRunResult = { content: string; role: SubagentRole; status: 'completed' | 'step_limit'; steps: number; agentId?: string };

export const SUBAGENT_TOOL_DEFINITION: AgentToolDefinition = {
  name: SUBAGENT_TOOL_NAME,
  description: 'Delegate a bounded research, review, or planning task to an isolated read-only subagent. The subagent cannot write, run commands, browse the web, or delegate recursively.',
  risk: 'network',
  parameters: {
    properties: {
      prompt: { type: 'string', description: 'Self-contained task and expected output for the subagent.' },
      role: { type: 'string', enum: [...SUBAGENT_ROLES], description: 'Subagent specialization. Defaults to explore.' },
      agentId: { type: 'string', description: 'Optional trusted and enabled custom agent profile id listed in the system prompt.' },
    },
    required: ['prompt'],
  },
};

export function parseSubagentRequest(args: Record<string, unknown>): SubagentRequest {
  const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
  if (!prompt) throw new Error('Subagent prompt is required.');
  if (prompt.length > MAX_SUBAGENT_PROMPT_CHARACTERS) throw new Error(`Subagent prompt exceeds ${MAX_SUBAGENT_PROMPT_CHARACTERS} characters.`);
  const role = args.role === undefined ? 'explore' : args.role;
  if (typeof role !== 'string' || !SUBAGENT_ROLES.includes(role as SubagentRole)) throw new Error('Subagent role is invalid.');
  const agentId = args.agentId === undefined ? undefined : typeof args.agentId === 'string' ? args.agentId.trim() : '';
  if (agentId !== undefined && !/^[a-zA-Z0-9_-]{1,100}$/.test(agentId)) throw new Error('Subagent agentId is invalid.');
  return { prompt, role: role as SubagentRole, ...(agentId ? { agentId } : {}) };
}
