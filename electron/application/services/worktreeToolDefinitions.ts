import type { AgentToolDefinition } from '../../domain/entities/tool.js';

export const ENTER_WORKTREE_TOOL_NAME = 'EnterWorktree';
export const EXIT_WORKTREE_TOOL_NAME = 'ExitWorktree';
export const WORKTREE_TOOL_NAMES = [ENTER_WORKTREE_TOOL_NAME, EXIT_WORKTREE_TOOL_NAME] as const;

const DEFINITIONS: AgentToolDefinition[] = [
  {
    name: ENTER_WORKTREE_TOOL_NAME,
    description: 'Create an isolated Git worktree and switch this chat session into it. Use only when the user explicitly asks for a worktree; do not infer it from an ordinary feature or branch request.',
    risk: 'write',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Optional worktree name. Slash-separated segments may use letters, digits, dots, underscores, and dashes; maximum 64 characters.',
        },
      },
    },
  },
  {
    name: EXIT_WORKTREE_TOOL_NAME,
    description: 'Exit the worktree created for this chat. Keep preserves its directory and branch; remove deletes both. Never remove dirty or unmerged work without explicit user confirmation.',
    risk: 'write',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['keep', 'remove'], description: 'Whether to preserve or delete the isolated worktree.' },
        discard_changes: { type: 'boolean', description: 'Use true only after explicit user confirmation when removal would discard files or commits.' },
      },
      required: ['action'],
    },
  },
];

export function getWorktreeToolDefinitions() {
  return DEFINITIONS.map((definition) => structuredClone(definition));
}
