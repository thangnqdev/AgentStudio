import type { AgentActionPayload } from '../../domain/entities/agent.js';
import { AGENT_TEAM_PROTOCOL_LEADER, AGENT_TEAM_PROTOCOL_VERSION, type AgentTeamProtocolMessage } from '../../domain/entities/agentTeamProtocol.js';
import { summarizeAgentWorker } from '../../domain/entities/agentWorker.js';
import type { IAgentTeamControlHandler } from '../../domain/ports/IAgentTeamControlHandler.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import type { IAgentWorkerRepository } from '../../domain/ports/IAgentWorkerRepository.js';
import type { IToolApprovalGateway } from '../../domain/ports/IToolApprovalGateway.js';
import type { AgentTeamProtocolRouter } from '../services/AgentTeamProtocolRouter.js';

type ActionSink = (scopeId: string, worker: ReturnType<typeof summarizeAgentWorker>, action: AgentActionPayload) => void;

export class ResolveAgentTeamControl implements IAgentTeamControlHandler {
  private readonly workers: IAgentWorkerRepository;
  private readonly teams: IAgentTeamRepository;
  private readonly approvals: IToolApprovalGateway;
  private readonly protocol: AgentTeamProtocolRouter;
  private readonly emitAction: ActionSink;

  constructor(workers: IAgentWorkerRepository, teams: IAgentTeamRepository, approvals: IToolApprovalGateway, protocol: AgentTeamProtocolRouter, emitAction: ActionSink) {
    this.workers = workers; this.teams = teams; this.approvals = approvals; this.protocol = protocol; this.emitAction = emitAction;
  }

  async handle(message: AgentTeamProtocolMessage) {
    if (!['permission_request', 'sandbox_permission_request', 'plan_approval_request'].includes(message.payload.type)) return false;
    const worker = await this.findWorker(message);
    if (!worker) throw new Error('Agent team control requester transcript is unavailable.');
    const request = approvalRequest(message);
    this.emit(worker, request.actionId, request.toolName, request.summary, request.risk, 'awaiting_approval');
    const approved = await this.approvals.requestApproval({ ...request, requestId: worker.id, workspaceRoot: worker.workspaceRoot });
    this.emit(worker, request.actionId, request.toolName, request.summary, request.risk, approved ? 'running' : 'denied');
    await this.protocol.dispatch({
      version: AGENT_TEAM_PROTOCOL_VERSION,
      id: `response:${message.id}`, teamId: message.teamId,
      from: AGENT_TEAM_PROTOCOL_LEADER, to: message.from, createdAt: new Date().toISOString(),
      payload: responsePayload(message, approved),
    });
    return true;
  }

  private async findWorker(message: AgentTeamProtocolMessage) {
    const team = (await this.teams.list()).find((candidate) => candidate.id === message.teamId);
    const workerId = team?.members.find((member) => member.name === message.from)?.workerId;
    return workerId ? await this.workers.get(workerId) : null;
  }

  private emit(worker: NonNullable<Awaited<ReturnType<ResolveAgentTeamControl['findWorker']>>>, id: string, toolName: string, args: string, risk: 'write' | 'execute' | 'network', status: AgentActionPayload['status']) {
    this.emitAction(worker.parentScopeId, summarizeAgentWorker(worker), { id, toolName, args, risk, status });
  }
}

function approvalRequest(message: AgentTeamProtocolMessage) {
  const payload = message.payload;
  if (payload.type === 'permission_request') return {
    actionId: payload.tool_use_id, toolName: payload.tool_name, risk: 'execute' as const,
    summary: `${payload.description}\n${boundedJson(payload.input)}`,
  };
  if (payload.type === 'sandbox_permission_request') return {
    actionId: payload.requestId, toolName: 'SandboxNetworkAccess', risk: 'network' as const,
    summary: `Allow ${payload.workerName} to access ${payload.hostPattern.host}?`, domain: payload.hostPattern.host,
  };
  if (payload.type === 'plan_approval_request') return {
    actionId: payload.requestId, toolName: 'ExitPlanMode', risk: 'write' as const,
    summary: payload.planContent.slice(0, 4_000),
  };
  throw new Error('Agent team control message is unsupported.');
}

function responsePayload(message: AgentTeamProtocolMessage, approved: boolean) {
  const payload = message.payload;
  const timestamp = new Date().toISOString();
  if (payload.type === 'permission_request') return approved
    ? { type: 'permission_response' as const, request_id: payload.request_id, subtype: 'success' as const, response: { updated_input: payload.input } }
    : { type: 'permission_response' as const, request_id: payload.request_id, subtype: 'error' as const, error: 'Permission denied.' };
  if (payload.type === 'sandbox_permission_request') {
    return { type: 'sandbox_permission_response' as const, requestId: payload.requestId, host: payload.hostPattern.host, allow: approved, timestamp };
  }
  if (payload.type === 'plan_approval_request') {
    return { type: 'plan_approval_response' as const, requestId: payload.requestId, approved, timestamp };
  }
  throw new Error('Agent team control message is unsupported.');
}

function boundedJson(value: unknown) { const output = JSON.stringify(value); return output.length <= 4_000 ? output : `${output.slice(0, 3_999)}…`; }
