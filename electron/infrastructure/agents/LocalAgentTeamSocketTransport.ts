import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import net, { type Server, type Socket } from 'node:net';
import path from 'node:path';
import type { AuthenticatedAgentTeamPeer } from '../../domain/entities/agentTeamTransport.js';
import type { IAgentTeamTransport, AgentTeamTransportReceiver } from '../../domain/ports/IAgentTeamTransport.js';
import type { TeamScopedCredentialService } from './TeamScopedCredentialService.js';
import {
  encodeAgentTeamFrame,
  LengthPrefixedFrameDecoder,
  parseAgentTeamHandshake,
  parseAgentTeamTransportFrame,
} from './agentTeamTransportFrames.js';

const HANDSHAKE_TIMEOUT_MS = 5_000;
const MAX_PENDING_WRITE_BYTES = 1_000_000;
type Connection = { socket: Socket; peer: AuthenticatedAgentTeamPeer };

export class LocalAgentTeamSocketTransport implements IAgentTeamTransport {
  private readonly directory: string | (() => string);
  private readonly credentials: TeamScopedCredentialService;
  private readonly connections = new Map<string, Connection>();
  private server?: Server;
  private receiver?: AgentTeamTransportReceiver;

  constructor(directory: string | (() => string), credentials: TeamScopedCredentialService) {
    this.directory = directory; this.credentials = credentials;
  }

  endpoint() {
    if (process.platform === 'win32') {
      const digest = createHash('sha256').update(this.resolveDirectory()).digest('hex').slice(0, 24);
      return `\\\\.\\pipe\\agentstudio-team-${digest}`;
    }
    return path.join(this.resolveDirectory(), 'team.sock');
  }

  async start(receiver: AgentTeamTransportReceiver) {
    if (this.server) throw new Error('Agent team transport is already running.');
    this.receiver = receiver;
    await this.prepareEndpoint();
    const server = net.createServer((socket) => this.accept(socket));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.endpoint(), () => { server.off('error', reject); resolve(); });
    });
    if (process.platform !== 'win32') await fs.chmod(this.endpoint(), 0o600);
  }

  async send(workerId: string, messageId: string, payload: string) {
    const connection = this.connections.get(workerId);
    if (!connection || connection.socket.destroyed) return false;
    try {
      const frame = encodeAgentTeamFrame({ type: 'message', messageId, payload });
      if (connection.socket.writableLength + frame.length > MAX_PENDING_WRITE_BYTES) {
        connection.socket.destroy(); return false;
      }
      connection.socket.write(frame);
      return true;
    } catch { return false; }
  }

  disconnect(workerId: string) {
    this.connections.get(workerId)?.socket.destroy();
    this.connections.delete(workerId);
  }

  async shutdown() {
    for (const connection of this.connections.values()) connection.socket.destroy();
    this.connections.clear();
    const server = this.server; this.server = undefined; this.receiver = undefined;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (process.platform !== 'win32') await this.removeSocket();
  }

  private accept(socket: Socket) {
    socket.setNoDelay(true);
    const decoder = new LengthPrefixedFrameDecoder();
    let connection: Connection | undefined;
    const timeout = setTimeout(() => socket.destroy(), HANDSHAKE_TIMEOUT_MS); timeout.unref();
    socket.on('data', (chunk) => {
      try {
        for (const value of decoder.push(chunk)) {
          if (!connection) {
            const handshake = parseAgentTeamHandshake(value);
            if (!this.credentials.verify(handshake)) throw new Error('Agent team authentication failed.');
            connection = { socket, peer: {
              teamId: handshake.teamId, workerId: handshake.workerId,
              instanceId: handshake.instanceId, epoch: handshake.epoch,
            } };
            this.replaceConnection(connection); clearTimeout(timeout);
            socket.write(encodeAgentTeamFrame({ type: 'handshake_ack', version: handshake.version }));
          } else {
            const frame = parseAgentTeamTransportFrame(value);
            void Promise.resolve(this.receiver?.(connection.peer, frame)).catch(() => socket.destroy());
          }
        }
      } catch { socket.destroy(); }
    });
    socket.on('close', () => {
      clearTimeout(timeout);
      if (connection && this.connections.get(connection.peer.workerId)?.socket === socket) {
        this.connections.delete(connection.peer.workerId);
      }
    });
    socket.on('error', () => undefined);
  }

  private replaceConnection(connection: Connection) {
    this.connections.get(connection.peer.workerId)?.socket.destroy();
    this.connections.set(connection.peer.workerId, connection);
  }

  private async prepareEndpoint() {
    if (process.platform === 'win32') return;
    await fs.mkdir(this.resolveDirectory(), { recursive: true, mode: 0o700 });
    const directory = await fs.lstat(this.resolveDirectory());
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Agent team socket directory is unsafe.');
    await fs.chmod(this.resolveDirectory(), 0o700);
    try {
      const target = await fs.lstat(this.endpoint());
      if (!target.isSocket() || target.isSymbolicLink()) throw new Error('Agent team socket target is unsafe.');
      await fs.rm(this.endpoint());
    } catch (error) { if (!missing(error)) throw error; }
  }

  private async removeSocket() {
    try {
      const target = await fs.lstat(this.endpoint());
      if (target.isSocket() && !target.isSymbolicLink()) await fs.rm(this.endpoint());
    } catch (error) { if (!missing(error)) throw error; }
  }

  private resolveDirectory() { return path.resolve(typeof this.directory === 'function' ? this.directory() : this.directory); }
}

function missing(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
