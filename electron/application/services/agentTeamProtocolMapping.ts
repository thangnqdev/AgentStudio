import type { AgentTeamProtocolMessage, AgentTeamProtocolPayload } from '../../domain/entities/agentTeamProtocol.js';
import type { AgentWorkerStructuredMessage, SendMessageRequest } from '../../domain/entities/agentWorker.js';

export function toAgentTeamProtocolPayload(
  message: SendMessageRequest['message'],
  context: { sender: string; requestId?: string; timestamp: string },
): AgentTeamProtocolPayload {
  if (typeof message === 'string') return { type: 'message', text: message };
  if (message.type === 'shutdown_request') {
    return {
      type: 'shutdown_request', requestId: message.request_id ?? context.requestId ?? crypto.randomUUID(),
      from: context.sender, ...(message.reason ? { reason: message.reason } : {}), timestamp: context.timestamp,
    };
  }
  if (message.type === 'shutdown_response') {
    return message.approve
      ? { type: 'shutdown_approved', requestId: message.request_id, from: context.sender, timestamp: context.timestamp }
      : { type: 'shutdown_rejected', requestId: message.request_id, from: context.sender, reason: message.reason ?? 'Shutdown rejected.', timestamp: context.timestamp };
  }
  return {
    type: 'plan_approval_response', requestId: message.request_id,
    approved: message.approve, ...(message.feedback ? { feedback: message.feedback } : {}), timestamp: context.timestamp,
  };
}

export function protocolMessageToWorkerRequest(message: AgentTeamProtocolMessage): SendMessageRequest {
  const payload = message.payload;
  if (payload.type === 'message') return { to: message.to, ...(message.summary ? { summary: message.summary } : {}), message: payload.text };
  let structured: AgentWorkerStructuredMessage | undefined;
  if (payload.type === 'shutdown_request') {
    structured = { type: 'shutdown_request', request_id: payload.requestId, ...(payload.reason ? { reason: payload.reason } : {}) };
  } else if (payload.type === 'shutdown_approved' || payload.type === 'shutdown_rejected') {
    structured = {
      type: 'shutdown_response', request_id: payload.requestId, approve: payload.type === 'shutdown_approved',
      ...(payload.type === 'shutdown_rejected' ? { reason: payload.reason } : {}),
    };
  } else if (payload.type === 'plan_approval_response') {
    structured = {
      type: 'plan_approval_response', request_id: payload.requestId, approve: payload.approved,
      ...(payload.feedback ? { feedback: payload.feedback } : {}),
    };
  }
  return {
    to: message.to, ...(message.summary ? { summary: message.summary } : {}),
    message: structured ?? JSON.stringify(payload),
  };
}
