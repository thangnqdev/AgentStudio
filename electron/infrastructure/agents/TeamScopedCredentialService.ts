import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  AGENT_TEAM_PROTOCOL_VERSION,
  type AgentTeamHandshake,
  type AgentTeamHandshakePayload,
} from '../../domain/entities/agentTeamTransport.js';

export { AGENT_TEAM_PROTOCOL_VERSION } from '../../domain/entities/agentTeamTransport.js';
export type { AgentTeamHandshake, AgentTeamHandshakePayload } from '../../domain/entities/agentTeamTransport.js';
const CLOCK_SKEW_MS = 30_000;
const MAX_REPLAY_NONCES = 10_000;

type Credential = { teamId: string; epoch: number; secret: string };

export class TeamScopedCredentialService {
  private readonly credentials = new Map<string, Credential>();
  private readonly usedNonces = new Map<string, number>();
  private readonly now: () => number;

  constructor(now = () => Date.now()) { this.now = now; }

  rotate(teamId: string, workerId: string) {
    validateIdentifier(teamId); validateIdentifier(workerId);
    const previous = this.credentials.get(workerId);
    const epoch = previous?.teamId === teamId ? previous.epoch + 1 : 1;
    const secret = randomBytes(32).toString('base64url');
    this.credentials.set(workerId, { teamId, epoch, secret });
    return { secret, epoch };
  }

  verify(handshake: AgentTeamHandshake) {
    this.pruneNonces();
    if (!validHandshake(handshake)) return false;
    const credential = this.credentials.get(handshake.workerId);
    if (!credential || credential.teamId !== handshake.teamId || credential.epoch !== handshake.epoch) return false;
    if (Math.abs(this.now() - handshake.timestamp) > CLOCK_SKEW_MS) return false;
    const replayKey = `${handshake.workerId}:${handshake.epoch}:${handshake.nonce}`;
    if (this.usedNonces.has(replayKey)) return false;
    const expected = signatureBytes(signAgentTeamHandshake(credential.secret, handshake));
    const actual = signatureBytes(handshake.signature);
    if (!expected || !actual || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
    this.usedNonces.set(replayKey, this.now() + CLOCK_SKEW_MS);
    while (this.usedNonces.size > MAX_REPLAY_NONCES) this.usedNonces.delete(this.usedNonces.keys().next().value!);
    return true;
  }

  revoke(workerId: string) {
    this.credentials.delete(workerId);
    for (const key of this.usedNonces.keys()) if (key.startsWith(`${workerId}:`)) this.usedNonces.delete(key);
  }

  clear() { this.credentials.clear(); this.usedNonces.clear(); }

  private pruneNonces() {
    const now = this.now();
    for (const [key, expiresAt] of this.usedNonces) if (expiresAt < now) this.usedNonces.delete(key);
  }
}

export function signAgentTeamHandshake(secret: string, payload: AgentTeamHandshakePayload) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) throw new Error('Agent team credential is invalid.');
  return createHmac('sha256', Buffer.from(secret, 'base64url')).update(canonicalPayload(payload)).digest('base64url');
}

function canonicalPayload(payload: AgentTeamHandshakePayload) {
  return JSON.stringify([
    payload.version, payload.teamId, payload.workerId, payload.instanceId,
    payload.epoch, payload.timestamp, payload.nonce,
  ]);
}

function validHandshake(value: AgentTeamHandshake) {
  return value.version === AGENT_TEAM_PROTOCOL_VERSION
    && validIdentifier(value.teamId) && validIdentifier(value.workerId)
    && validIdentifier(value.instanceId) && validIdentifier(value.nonce)
    && Number.isSafeInteger(value.epoch) && value.epoch > 0
    && Number.isSafeInteger(value.timestamp) && typeof value.signature === 'string';
}

function validateIdentifier(value: string) {
  if (!validIdentifier(value)) throw new Error('Agent team identity is invalid.');
}

function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !value.includes('\0');
}

function signatureBytes(value: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return undefined;
  return Buffer.from(value, 'base64url');
}
