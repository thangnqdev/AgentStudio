import { describe, expect, it } from 'vitest';
import {
  AGENT_TEAM_PROTOCOL_VERSION,
  signAgentTeamHandshake,
  TeamScopedCredentialService,
  type AgentTeamHandshakePayload,
} from './TeamScopedCredentialService.js';

function payload(now: number, epoch: number, nonce = 'nonce-1'): AgentTeamHandshakePayload {
  return {
    version: AGENT_TEAM_PROTOCOL_VERSION, teamId: 'team-1', workerId: 'worker-1',
    instanceId: 'instance-1', epoch, timestamp: now, nonce,
  };
}

describe('TeamScopedCredentialService', () => {
  it('authenticates one current-epoch handshake and rejects replay', () => {
    const now = 10_000_000;
    const service = new TeamScopedCredentialService(() => now);
    const credential = service.rotate('team-1', 'worker-1');
    const unsigned = payload(now, credential.epoch);
    const handshake = { ...unsigned, signature: signAgentTeamHandshake(credential.secret, unsigned) };
    expect(service.verify(handshake)).toBe(true);
    expect(service.verify(handshake)).toBe(false);
  });

  it('rejects wrong secrets, expired timestamps and stale epochs', () => {
    const now = 10_000_000;
    const service = new TeamScopedCredentialService(() => now);
    const first = service.rotate('team-1', 'worker-1');
    const wrong = new TeamScopedCredentialService(() => now).rotate('team-1', 'worker-1');
    const currentPayload = payload(now, first.epoch);
    expect(service.verify({ ...currentPayload, signature: signAgentTeamHandshake(wrong.secret, currentPayload) })).toBe(false);
    const expired = payload(now - 30_001, first.epoch, 'nonce-expired');
    expect(service.verify({ ...expired, signature: signAgentTeamHandshake(first.secret, expired) })).toBe(false);
    const second = service.rotate('team-1', 'worker-1');
    const stale = payload(now, first.epoch, 'nonce-stale');
    expect(service.verify({ ...stale, signature: signAgentTeamHandshake(first.secret, stale) })).toBe(false);
    const current = payload(now, second.epoch, 'nonce-current');
    expect(service.verify({ ...current, signature: signAgentTeamHandshake(second.secret, current) })).toBe(true);
  });

  it('binds credentials to their team and supports revocation', () => {
    const now = 10_000_000;
    const service = new TeamScopedCredentialService(() => now);
    const credential = service.rotate('team-1', 'worker-1');
    const crossTeam = { ...payload(now, credential.epoch), teamId: 'team-2' };
    expect(service.verify({ ...crossTeam, signature: signAgentTeamHandshake(credential.secret, crossTeam) })).toBe(false);
    service.revoke('worker-1');
    const revoked = payload(now, credential.epoch, 'nonce-revoked');
    expect(service.verify({ ...revoked, signature: signAgentTeamHandshake(credential.secret, revoked) })).toBe(false);
  });
});
