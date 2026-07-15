export type CreateAgentTeamInput = {
  teamName: string;
  description?: string;
  agentType?: string;
};

export function parseCreateAgentTeamInput(raw: Record<string, unknown>): CreateAgentTeamInput {
  rejectUnknown(raw, ['team_name', 'description', 'agent_type']);
  const teamName = text(raw.team_name, 64, 'Team name is required.');
  const description = optionalText(raw.description, 1_000, 'Team description is invalid.');
  const agentType = optionalText(raw.agent_type, 100, 'Team lead agent_type is invalid.');
  return { teamName, ...(description ? { description } : {}), ...(agentType ? { agentType } : {}) };
}

export function assertDeleteAgentTeamInput(raw: Record<string, unknown>) {
  rejectUnknown(raw, []);
}

function optionalText(value: unknown, maximum: number, message: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.includes('\0')) throw new Error(message);
  const result = value.trim();
  if (!result || result.length > maximum) throw new Error(message);
  return result;
}

function text(value: unknown, maximum: number, message: string) {
  const result = optionalText(value, maximum, message);
  if (!result) throw new Error(message);
  return result;
}

function rejectUnknown(raw: Record<string, unknown>, allowed: string[]) {
  const extra = Object.keys(raw).find((key) => !allowed.includes(key));
  if (extra) throw new Error(`Unexpected team input property: ${extra}.`);
}
