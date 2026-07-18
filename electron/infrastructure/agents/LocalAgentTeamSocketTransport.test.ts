import fs from 'node:fs/promises';
import net, { type Socket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AGENT_TEAM_PROTOCOL_VERSION } from '../../domain/entities/agentTeamTransport.js';
import {
  encodeAgentTeamFrame,
  LengthPrefixedFrameDecoder,
  parseAgentTeamTransportFrame,
} from './agentTeamTransportFrames.js';
import { LocalAgentTeamSocketTransport } from './LocalAgentTeamSocketTransport.js';
import { signAgentTeamHandshake, TeamScopedCredentialService } from './TeamScopedCredentialService.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { await Promise.allSettled(cleanups.splice(0).map((cleanup) => cleanup())); });

describe('LocalAgentTeamSocketTransport', () => {
  it('authenticates a peer, derives its sender identity and exchanges framed messages', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-team-socket-'));
    const now = Date.now();
    const credentials = new TeamScopedCredentialService(() => now);
    const issued = credentials.rotate('team-1', 'worker-1');
    const received = vi.fn();
    const transport = new LocalAgentTeamSocketTransport(directory, credentials);
    await transport.start(received);
    cleanups.push(async () => { await transport.shutdown(); await fs.rm(directory, { recursive: true, force: true }); });

    const socket = await connect(transport.endpoint());
    const handshake = {
      type: 'handshake', version: AGENT_TEAM_PROTOCOL_VERSION, teamId: 'team-1', workerId: 'worker-1',
      instanceId: 'instance-1', epoch: issued.epoch, timestamp: now, nonce: 'nonce-1',
    } as const;
    socket.write(encodeAgentTeamFrame({ ...handshake, signature: signAgentTeamHandshake(issued.secret, handshake) }));
    await expect(readFrame(socket)).resolves.toEqual({ type: 'handshake_ack', version: AGENT_TEAM_PROTOCOL_VERSION });

    socket.write(encodeAgentTeamFrame({ type: 'message', messageId: 'message-1', recipient: 'team-lead', payload: '{"type":"idle_notification"}' }));
    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce());
    expect(received.mock.calls[0][0]).toEqual({ teamId: 'team-1', workerId: 'worker-1', instanceId: 'instance-1', epoch: issued.epoch });
    expect(received.mock.calls[0][1]).toMatchObject({ type: 'message', messageId: 'message-1', recipient: 'team-lead' });

    await expect(transport.send('worker-1', 'message-2', '{"type":"shutdown_request"}')).resolves.toBe(true);
    await expect(readFrame(socket)).resolves.toEqual({ type: 'message', messageId: 'message-2', payload: '{"type":"shutdown_request"}' });
    socket.destroy();
  });

  it('rejects replayed handshakes and untrusted sender fields', async () => {
    expect(() => parseAgentTeamTransportFrame({
      type: 'message', messageId: 'message-1', recipient: 'team-lead', payload: '{}', from: 'team-lead',
    })).toThrow('payload is invalid');

    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-team-replay-'));
    const now = Date.now();
    const credentials = new TeamScopedCredentialService(() => now);
    const issued = credentials.rotate('team-1', 'worker-1');
    const transport = new LocalAgentTeamSocketTransport(directory, credentials);
    await transport.start(() => undefined);
    cleanups.push(async () => { await transport.shutdown(); await fs.rm(directory, { recursive: true, force: true }); });
    const unsigned = {
      version: AGENT_TEAM_PROTOCOL_VERSION, teamId: 'team-1', workerId: 'worker-1',
      instanceId: 'instance-1', epoch: issued.epoch, timestamp: now, nonce: 'replay-nonce',
    } as const;
    const wire = encodeAgentTeamFrame({ type: 'handshake', ...unsigned, signature: signAgentTeamHandshake(issued.secret, unsigned) });
    const first = await connect(transport.endpoint()); first.write(wire); await readFrame(first);
    const replay = await connect(transport.endpoint()); replay.write(wire);
    await expect(closed(replay)).resolves.toBeUndefined();
    first.destroy();
  });

  it.runIf(process.platform !== 'win32')('refuses a pre-existing symlink socket target', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-team-symlink-'));
    const target = path.join(directory, 'real'); await fs.writeFile(target, 'unsafe');
    await fs.symlink(target, path.join(directory, 'team.sock'));
    cleanups.push(() => fs.rm(directory, { recursive: true, force: true }));
    const transport = new LocalAgentTeamSocketTransport(directory, new TeamScopedCredentialService());
    await expect(transport.start(() => undefined)).rejects.toThrow('socket target is unsafe');
  });
});

function connect(endpoint: string) {
  return new Promise<Socket>((resolve, reject) => {
    const socket = net.createConnection(endpoint, () => resolve(socket));
    socket.once('error', reject);
  });
}

function readFrame(socket: Socket) {
  const decoder = new LengthPrefixedFrameDecoder();
  return new Promise<unknown>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      try {
        const frame = decoder.push(chunk)[0];
        if (frame !== undefined) { socket.off('data', onData); resolve(frame); }
      } catch (error) { reject(error); }
    };
    socket.on('data', onData); socket.once('error', reject);
  });
}

function closed(socket: Socket) {
  return new Promise<void>((resolve) => socket.once('close', () => resolve()));
}
