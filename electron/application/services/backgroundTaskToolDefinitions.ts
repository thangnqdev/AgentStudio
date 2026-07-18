import type { AgentToolDefinition } from '../../domain/entities/tool.js';

export const TASK_OUTPUT_TOOL_NAMES = ['TaskOutput', 'task_output', 'AgentOutputTool', 'BashOutputTool'] as const;
export const TASK_STOP_TOOL_NAMES = ['TaskStop', 'task_stop', 'KillShell'] as const;
export const BACKGROUND_TASK_TOOL_NAMES = [...TASK_OUTPUT_TOOL_NAMES, ...TASK_STOP_TOOL_NAMES] as const;

const outputParameters = {
  type: 'object', additionalProperties: false,
  properties: {
    task_id: { type: 'string', description: 'Background shell or agent task ID.' },
    taskId: { type: 'string', description: 'Compatibility alias for task_id.' },
    agent_id: { type: 'string', description: 'Deprecated agent-output alias for task_id.' },
    bash_id: { type: 'string', description: 'Deprecated bash-output alias for task_id.' },
    shell_id: { type: 'string', description: 'Deprecated shell-output alias for task_id.' },
    block: { type: 'boolean', description: 'Wait for completion; defaults to true.' },
    timeout: { type: 'integer', minimum: 0, maximum: 600_000, description: 'Maximum wait in milliseconds; defaults to 30000.' },
    timeoutMs: { type: 'integer', minimum: 0, maximum: 600_000, description: 'Compatibility alias for timeout.' },
  }, required: ['task_id'],
};

const stopParameters = {
  type: 'object', additionalProperties: false,
  properties: {
    task_id: { type: 'string', description: 'Background shell or agent task ID.' },
    taskId: { type: 'string', description: 'Compatibility alias for task_id.' },
    shell_id: { type: 'string', description: 'Deprecated compatibility alias for task_id.' },
    agent_id: { type: 'string', description: 'Deprecated compatibility alias for task_id.' },
  },
};

export const BACKGROUND_TASK_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  tool('TaskOutput', 'Retrieve bounded output and status from a background shell or agent task.', 'read', outputParameters),
  tool('TaskStop', 'Stop a running background shell or agent task by ID.', 'execute', stopParameters),
  tool('task_output', 'Compatibility alias for TaskOutput.', 'read', { ...outputParameters, required: [] }),
  tool('task_stop', 'Compatibility alias for TaskStop.', 'execute', stopParameters),
  tool('AgentOutputTool', 'Deprecated compatibility alias for TaskOutput.', 'read', outputParameters),
  tool('BashOutputTool', 'Deprecated compatibility alias for TaskOutput.', 'read', outputParameters),
  tool('KillShell', 'Deprecated compatibility alias for TaskStop.', 'execute', stopParameters),
];

function tool(name: string, description: string, risk: 'read' | 'execute', parameters: Record<string, unknown>): AgentToolDefinition {
  return {
    name, description, risk, concurrencySafe: true, deferLoading: true,
    searchHint: risk === 'read' ? 'read wait background task output agent shell' : 'stop kill background task agent shell',
    parameters,
  };
}
