import {
  AGENT_TEAM_PROTOCOL_VERSION,
  MAX_AGENT_TEAM_TRANSPORT_FRAME_BYTES,
  type AgentTeamHandshake,
  type AgentTeamTransportFrame,
} from '../../domain/entities/agentTeamTransport.js';

export class LengthPrefixedFrameDecoder {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames: unknown[] = [];
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32BE(0);
      if (length === 0 || length > MAX_AGENT_TEAM_TRANSPORT_FRAME_BYTES) throw new Error('Agent team transport frame is invalid.');
      if (this.buffer.length < length + 4) break;
      const raw = this.buffer.subarray(4, length + 4).toString('utf8');
      this.buffer = this.buffer.subarray(length + 4);
      frames.push(JSON.parse(raw) as unknown);
    }
    if (this.buffer.length > MAX_AGENT_TEAM_TRANSPORT_FRAME_BYTES + 4) throw new Error('Agent team transport buffer is too large.');
    return frames;
  }
}

export function encodeAgentTeamFrame(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value));
  if (payload.length === 0 || payload.length > MAX_AGENT_TEAM_TRANSPORT_FRAME_BYTES) throw new Error('Agent team transport frame is too large.');
  const frame = Buffer.allocUnsafe(payload.length + 4);
  frame.writeUInt32BE(payload.length, 0); payload.copy(frame, 4);
  return frame;
}

export function parseAgentTeamHandshake(value: unknown): AgentTeamHandshake {
  if (!isObject(value) || value.type !== 'handshake' || !hasOnly(value, [
    'type', 'version', 'teamId', 'workerId', 'instanceId', 'epoch', 'timestamp', 'nonce', 'signature',
  ])) invalid();
  if (value.version !== AGENT_TEAM_PROTOCOL_VERSION) invalid();
  for (const key of ['teamId', 'workerId', 'instanceId', 'nonce', 'signature'] as const) if (!validText(value[key], 256)) invalid();
  if (!Number.isSafeInteger(value.epoch) || Number(value.epoch) <= 0 || !Number.isSafeInteger(value.timestamp)) invalid();
  const { type: _type, ...handshake } = value;
  return handshake as AgentTeamHandshake;
}

export function parseAgentTeamTransportFrame(value: unknown): AgentTeamTransportFrame {
  if (!isObject(value) || typeof value.type !== 'string') invalid();
  if (value.type === 'message') {
    if (!hasOnly(value, ['type', 'messageId', 'recipient', 'payload'])
      || !validText(value.messageId, 256) || !validText(value.recipient, 128)
      || !validText(value.payload, 200_000)) invalid();
    return value as AgentTeamTransportFrame;
  }
  if (value.type === 'ack') {
    if (!hasOnly(value, ['type', 'messageId']) || !validText(value.messageId, 256)) invalid();
    return value as AgentTeamTransportFrame;
  }
  if (value.type === 'heartbeat') {
    if (!hasOnly(value, ['type', 'timestamp']) || !Number.isSafeInteger(value.timestamp)) invalid();
    return value as AgentTeamTransportFrame;
  }
  return invalid();
}

function hasOnly(value: Record<string, unknown>, keys: string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key)) && keys.every((key) => key in value);
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !value.includes('\0');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(): never { throw new Error('Agent team transport payload is invalid.'); }
