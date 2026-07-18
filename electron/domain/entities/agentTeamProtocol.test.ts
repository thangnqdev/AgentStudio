import { describe, expect, it } from 'vitest';
import type { AgentTeamProtocolMessage, AgentTeamProtocolPayload } from './agentTeamProtocol.js';
import { parseAgentTeamProtocolMessage, parseAgentTeamProtocolPayload } from './agentTeamProtocolParser.js';
import { assertAgentTeamProtocolDirection, getLastAgentTeamPeerDmSummary } from './agentTeamProtocolPolicy.js';

const timestamp = '2026-07-16T00:00:00.000Z';

describe('agent team protocol parsing', () => {
  it('accepts every bounded reference envelope shape', () => {
    const payloads: AgentTeamProtocolPayload[] = [
      { type: 'message', text: 'Review the timeout.' },
      { type: 'permission_request', request_id: 'p1', agent_id: 'worker', tool_name: 'Bash', tool_use_id: 'u1', description: 'Run tests', input: { command: 'npm test' }, permission_suggestions: [] },
      { type: 'permission_response', request_id: 'p1', subtype: 'success', response: { updated_input: { command: 'npm test' }, permission_updates: [] } },
      { type: 'permission_response', request_id: 'p2', subtype: 'error', error: 'Denied' },
      { type: 'sandbox_permission_request', requestId: 's1', workerId: 'worker-id', workerName: 'worker', hostPattern: { host: 'example.com' }, createdAt: 1 },
      { type: 'sandbox_permission_response', requestId: 's1', host: 'example.com', allow: true, timestamp },
      { type: 'plan_approval_request', from: 'worker', timestamp, planFilePath: '/tmp/plan.md', planContent: '# Plan', requestId: 'plan1' },
      { type: 'plan_approval_response', requestId: 'plan1', approved: true, timestamp, permissionMode: 'default' },
      { type: 'shutdown_request', requestId: 'stop1', from: 'team-lead', reason: 'Done', timestamp },
      { type: 'shutdown_approved', requestId: 'stop1', from: 'worker', timestamp, paneId: 'pane-1', backendType: 'in-process' },
      { type: 'shutdown_rejected', requestId: 'stop2', from: 'worker', reason: 'Still working', timestamp },
      { type: 'idle_notification', from: 'worker', timestamp, idleReason: 'available', summary: '[to peer] Shared findings', completedStatus: 'resolved' },
      { type: 'task_assignment', taskId: '7', subject: 'Review', description: 'Review auth', assignedBy: 'team-lead', timestamp },
      { type: 'team_permission_update', permissionUpdate: { type: 'addRules', rules: [{ toolName: 'Edit', ruleContent: '/workspace/**' }], behavior: 'allow', destination: 'session' }, directoryPath: '/workspace', toolName: 'Edit' },
      { type: 'mode_set_request', mode: 'plan', from: 'team-lead' },
    ];
    for (const payload of payloads) expect(parseAgentTeamProtocolPayload(payload)).toEqual(payload);
  });

  it('rejects unknown fields, malformed nesting and oversized content', () => {
    expect(() => parseAgentTeamProtocolPayload({ type: 'shutdown_request', requestId: 's', from: 'team-lead', timestamp, forged: true })).toThrow('unknown field');
    expect(() => parseAgentTeamProtocolPayload({ type: 'sandbox_permission_request', requestId: 's', workerId: 'w', workerName: 'worker', hostPattern: {}, createdAt: 1 })).toThrow('host');
    expect(() => parseAgentTeamProtocolPayload({ type: 'message', text: 'x'.repeat(20_001) })).toThrow('text');
    expect(() => parseAgentTeamProtocolMessage({ ...message({ type: 'message', text: 'ok' }), summary: 'x'.repeat(161) })).toThrow('summary');
  });
});

describe('agent team protocol policy', () => {
  it('enforces leader/teammate direction and authenticated sender identity', () => {
    const request = message({ type: 'permission_request', request_id: 'p1', agent_id: 'worker', tool_name: 'Bash', tool_use_id: 'u1', description: 'Run', input: {}, permission_suggestions: [] }, 'worker', 'team-lead');
    expect(() => assertAgentTeamProtocolDirection(request, 'teammate', 'leader')).not.toThrow();
    expect(() => assertAgentTeamProtocolDirection(request, 'leader', 'teammate')).toThrow('invalid sender');
    expect(() => assertAgentTeamProtocolDirection({ ...request, from: 'peer' }, 'teammate', 'leader')).toThrow('requester');
    const approval = message({ type: 'plan_approval_response', requestId: 'plan1', approved: true, timestamp }, 'peer', 'worker');
    expect(() => assertAgentTeamProtocolDirection(approval, 'teammate', 'teammate')).toThrow('invalid sender');
    const peerShutdown = message({ type: 'shutdown_request', requestId: 'stop1', from: 'peer', timestamp }, 'peer', 'worker');
    expect(() => assertAgentTeamProtocolDirection(peerShutdown, 'teammate', 'teammate')).not.toThrow();
    expect(() => assertAgentTeamProtocolDirection({ ...peerShutdown, to: 'team-lead' }, 'teammate', 'leader')).toThrow('invalid sender');
  });

  it('extracts the last peer DM summary without crossing a user-turn boundary', () => {
    expect(getLastAgentTeamPeerDmSummary([
      { role: 'user', content: 'start' },
      { role: 'assistant', content: '', tool_calls: [{ id: '1', function: { name: 'SendMessage', arguments: JSON.stringify({ to: 'reviewer', summary: 'Found the timeout race', message: 'Details' }) } }] },
      { role: 'tool', content: 'ok' },
    ])).toBe('[to reviewer] Found the timeout race');
    expect(getLastAgentTeamPeerDmSummary([
      { role: 'assistant', content: '', tool_calls: [{ id: '1', function: { name: 'SendMessage', arguments: JSON.stringify({ to: 'old-peer', message: 'old' }) } }] },
      { role: 'user', content: 'new turn' },
      { role: 'assistant', content: '', tool_calls: [{ id: '2', function: { name: 'SendMessage', arguments: JSON.stringify({ to: 'team-lead', message: 'not a peer' }) } }] },
    ])).toBeUndefined();
  });
});

function message(payload: AgentTeamProtocolPayload, from = 'team-lead', to = 'worker'): AgentTeamProtocolMessage {
  return { version: 1, id: `message-${payload.type}`, teamId: 'team-1', from, to, createdAt: timestamp, payload };
}
