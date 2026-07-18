import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalAgentTeamSocketTransport } from './LocalAgentTeamSocketTransport.js';
import { LocalAgentWorkerProcessHost } from './LocalAgentWorkerProcessHost.js';
import { TeamScopedCredentialService } from './TeamScopedCredentialService.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { delete process.env.UNSAFE_AGENT_SECRET; await Promise.allSettled(cleanups.splice(0).map((cleanup) => cleanup())); });

describe('LocalAgentWorkerProcessHost', () => {
  it('passes credentials through fd 3, filters env, and authenticates a real child process', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-team-child-'));
    const credentials = new TeamScopedCredentialService();
    const transport = new LocalAgentTeamSocketTransport(directory, credentials);
    const receive = vi.fn(); await transport.start(receive);
    cleanups.push(async () => { await transport.shutdown(); await fs.rm(directory, { recursive: true, force: true }); });
    const issued = credentials.rotate('team-id', 'worker-id');
    process.env.UNSAFE_AGENT_SECRET = 'must-not-cross-process';
    const fixture = fileURLToPath(new URL('./fixtures/team-process-client.mjs', import.meta.url));
    const host = new LocalAgentWorkerProcessHost(fixture);
    const result = await host.run({
      cwd: process.cwd(),
      bootstrap: {
        endpoint: transport.endpoint(), teamId: 'team-id', workerId: 'worker-id', instanceId: 'instance-id',
        epoch: issued.epoch, secret: issued.secret,
        outbound: { messageId: 'child-message', recipient: 'team-lead', payload: JSON.stringify({ type: 'message', text: 'hello' }) },
      },
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ connected: true, unsafeEnvPresent: false });
    await vi.waitFor(() => expect(receive).toHaveBeenCalledOnce());
    expect(receive.mock.calls[0]).toEqual([
      { teamId: 'team-id', workerId: 'worker-id', instanceId: 'instance-id', epoch: issued.epoch },
      { type: 'message', messageId: 'child-message', recipient: 'team-lead', payload: JSON.stringify({ type: 'message', text: 'hello' }) },
    ]);
  });
});
