import type { AgentToolDefinition } from './tool.js';

export const AGENT_CONFIG_TOOL_NAME = 'Config';
export const AGENT_CONFIG_SETTING_NAMES = [
  'model',
  'fallbackModel',
  'permissions.defaultMode',
] as const;

export type AgentConfigSetting = typeof AGENT_CONFIG_SETTING_NAMES[number];

export const AGENT_CONFIG_TOOL_DEFINITION: AgentToolDefinition = {
  name: AGENT_CONFIG_TOOL_NAME,
  description: [
    'Get or set an allow-listed AgentStudio configuration value.',
    'Supported settings: model, fallbackModel, permissions.defaultMode.',
    'Omit value to read. Mutations require explicit local approval.',
  ].join(' '),
  risk: 'write',
  concurrencySafe: false,
  deferLoading: true,
  searchHint: 'get set configuration model fallback permission mode settings',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      setting: { type: 'string', enum: [...AGENT_CONFIG_SETTING_NAMES] },
      value: { type: 'string', maxLength: 512 },
    },
    required: ['setting'],
  },
};

export function isAgentConfigSetting(value: unknown): value is AgentConfigSetting {
  return typeof value === 'string' && (AGENT_CONFIG_SETTING_NAMES as readonly string[]).includes(value);
}
