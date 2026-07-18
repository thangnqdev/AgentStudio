import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentTeamProtocolMessage, AgentTeamProtocolPayload } from '../../domain/entities/agentTeamProtocol.js';
import { PrivateAgentTeamProtocolStore } from './PrivateAgentTeamProtocolStore.js';

let directory = '';
let now = Date.parse('2026-07-16T00:00:10.000Z');

beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-team-protocol-')); now = Date.parse('2026-07-16T00:00:10.000Z'); });
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

describe('PrivateAgentTeamProtocolStore', () => {
  it('claims shutdown before leader mail before peer FIFO', async () => {
    const store = new PrivateAgentTeamProtocolStore(directory, () => new Date(now));
    await store.append(message('peer-old', 'peer', { type: 'message', text: 'peer old' }, '2026-07-16T00:00:00.000Z'));
    await store.append(message('peer-new', 'peer', { type: 'message', text: 'peer new' }, '2026-07-16T00:00:02.000Z'));
    await store.append(message('leader', 'team-lead', { type: 'message', text: 'leader instruction' }, '2026-07-16T00:00:03.000Z'));
    await store.append(message('shutdown', 'team-lead', { type: 'shutdown_request', requestId: 'stop-1', from: 'team-lead', timestamp: '2026-07-16T00:00:04.000Z' }, '2026-07-16T00:00:04.000Z'));

    for (const expected of ['shutdown', 'leader', 'peer-old', 'peer-new']) {
      const claim = await store.claim('team-1', 'worker', 'consumer');
      expect(claim?.message.id).toBe(expected);
      expect(await store.ack('team-1', expected, claim!.leaseId)).toBe(true);
    }
    expect(await store.claim('team-1', 'worker', 'consumer')).toBeNull();
  });

  it('redelivers an unacked claim after lease expiry and remembers duplicate IDs after ack', async () => {
    const firstProcess = new PrivateAgentTeamProtocolStore(directory, () => new Date(now));
    const original = message('durable', 'peer', { type: 'message', text: 'persist me' }, '2026-07-16T00:00:00.000Z');
    expect(await firstProcess.append(original)).toBe(true);
    expect(await firstProcess.append(original)).toBe(false);
    const abandoned = await firstProcess.claim('team-1', 'worker', 'process-1', 1_000);

    now += 1_001;
    const restartedProcess = new PrivateAgentTeamProtocolStore(directory, () => new Date(now));
    const recovered = await restartedProcess.claim('team-1', 'worker', 'process-2', 1_000);
    expect(recovered?.message).toEqual(original);
    expect(recovered?.leaseId).not.toBe(abandoned?.leaseId);
    expect(await restartedProcess.ack('team-1', 'durable', abandoned!.leaseId)).toBe(false);
    expect(await restartedProcess.ack('team-1', 'durable', recovered!.leaseId)).toBe(true);
    expect(await restartedProcess.append(original)).toBe(false);

    const files = await fs.readdir(directory);
    expect(files).toEqual([expect.stringMatching(/^[a-f0-9]{64}\.json$/)]);
    expect((await fs.stat(path.join(directory, files[0]!))).mode & 0o777).toBe(0o600);
  });

  it('makes a released claim immediately available again', async () => {
    const store = new PrivateAgentTeamProtocolStore(directory, () => new Date(now));
    await store.append(message('released', 'peer', { type: 'message', text: 'retry now' }, '2026-07-16T00:00:00.000Z'));
    const first = await store.claim('team-1', 'worker', 'process-1');
    expect(await store.release('team-1', 'released', first!.leaseId)).toBe(true);
    const second = await store.claim('team-1', 'worker', 'process-2');
    expect(second?.message.id).toBe('released');
    expect(second?.leaseId).not.toBe(first?.leaseId);
  });
});

function message(id: string, from: string, payload: AgentTeamProtocolPayload, createdAt: string): AgentTeamProtocolMessage {
  return { version: 1, id, teamId: 'team-1', from, to: 'worker', createdAt, payload };
}
