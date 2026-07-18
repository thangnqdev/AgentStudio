import {
  AGENT_TEAM_PROTOCOL_LEADER,
  type AgentTeamPeerSummaryInput,
  type AgentTeamProtocolDelivery,
  type AgentTeamProtocolMessage,
  type AgentTeamProtocolRole,
} from './agentTeamProtocol.js';

const TEAMMATE_TO_LEADER = new Set([
  'permission_request', 'sandbox_permission_request', 'plan_approval_request',
  'shutdown_approved', 'shutdown_rejected', 'idle_notification',
]);
const LEADER_TO_TEAMMATE = new Set([
  'permission_response', 'sandbox_permission_response', 'plan_approval_response',
  'team_permission_update', 'mode_set_request',
]);

export function assertAgentTeamProtocolDirection(
  message: AgentTeamProtocolMessage,
  senderRole: AgentTeamProtocolRole,
  recipientRole: AgentTeamProtocolRole,
): void {
  if (message.from === message.to) throw new Error('Agent team protocol cannot target the sender.');
  const type = message.payload.type;
  if (TEAMMATE_TO_LEADER.has(type) && (senderRole !== 'teammate' || recipientRole !== 'leader')) invalidDirection(type);
  if (LEADER_TO_TEAMMATE.has(type) && (senderRole !== 'leader' || recipientRole !== 'teammate')) invalidDirection(type);
  if (type === 'shutdown_request' && recipientRole !== 'teammate') invalidDirection(type);
  assertEmbeddedSender(message);
}

export function compareAgentTeamProtocolDelivery(left: AgentTeamProtocolDelivery, right: AgentTeamProtocolDelivery) {
  const priority = deliveryPriority(left.message) - deliveryPriority(right.message);
  if (priority !== 0) return priority;
  const created = left.message.createdAt.localeCompare(right.message.createdAt);
  return created !== 0 ? created : left.sequence - right.sequence;
}

export function deliveryPriority(message: AgentTeamProtocolMessage) {
  if (message.payload.type === 'shutdown_request') return 0;
  if (message.from.toLowerCase() === AGENT_TEAM_PROTOCOL_LEADER) return 1;
  return 2;
}

export function getLastAgentTeamPeerDmSummary(messages: AgentTeamPeerSummaryInput[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    if (message.role === 'user' && typeof message.content === 'string') break;
    if (message.role !== 'assistant') continue;
    for (const call of message.tool_calls ?? []) {
      if (call.function?.name !== 'SendMessage' || typeof call.function.arguments !== 'string') continue;
      const input = parseArguments(call.function.arguments);
      if (!input || typeof input.to !== 'string' || input.to === '*' || input.to.toLowerCase() === AGENT_TEAM_PROTOCOL_LEADER) continue;
      if (typeof input.message !== 'string') continue;
      const summary = typeof input.summary === 'string' && input.summary ? input.summary : input.message.slice(0, 80);
      return `[to ${input.to}] ${summary}`;
    }
  }
  return undefined;
}

function assertEmbeddedSender(message: AgentTeamProtocolMessage) {
  const payload = message.payload;
  if ('from' in payload && payload.from !== message.from) throw new Error('Agent team protocol sender does not match its envelope.');
  if (payload.type === 'permission_request' && payload.agent_id !== message.from) throw new Error('Permission requester does not match its envelope.');
  if (payload.type === 'sandbox_permission_request' && payload.workerName !== message.from) throw new Error('Sandbox requester does not match its envelope.');
  if (payload.type === 'task_assignment' && payload.assignedBy !== message.from) throw new Error('Task assigner does not match its envelope.');
}

function parseArguments(value: string): Record<string, unknown> | null {
  try { const parsed = JSON.parse(value) as unknown; return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null; }
  catch { return null; }
}
function invalidDirection(type: string): never { throw new Error(`Agent team protocol ${type} has an invalid sender or recipient role.`); }
