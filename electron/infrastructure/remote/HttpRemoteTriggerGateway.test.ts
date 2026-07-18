import { describe, expect, it, vi } from 'vitest';
import { HttpRemoteTriggerGateway } from './HttpRemoteTriggerGateway.js';

const settings = { enabled: true, baseUrl: 'https://api.example.com', bearerToken: 'secret-token' };

describe('HttpRemoteTriggerGateway', () => {
  it('builds exact routes and keeps credentials in the authorization header', async () => {
    const fetcher = vi.fn(async () => new Response('{"ok":true}', { status: 201, headers: { 'content-type': 'application/json' } }));
    const gateway = new HttpRemoteTriggerGateway(fetcher as typeof fetch);
    await expect(gateway.execute({ action: 'update', trigger_id: 'daily', body: { prompt: 'go' } }, settings)).resolves.toEqual({ status: 201, json: '{"ok":true}' });
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/v1/code/triggers/daily', expect.objectContaining({
      method: 'POST', redirect: 'manual', body: '{"prompt":"go"}',
      headers: expect.objectContaining({ authorization: 'Bearer secret-token' }),
    }));
  });

  it('rejects redirects and oversized streaming responses', async () => {
    const redirect = new HttpRemoteTriggerGateway(vi.fn(async () => new Response('', { status: 302 })) as typeof fetch);
    await expect(redirect.execute({ action: 'list' }, settings)).rejects.toThrow('redirects are not allowed');
    const large = new HttpRemoteTriggerGateway(vi.fn(async () => new Response('x'.repeat(100_001))) as typeof fetch);
    await expect(large.execute({ action: 'list' }, settings)).rejects.toThrow('100,000-byte');
  });

  it('redacts a credential echoed by an untrusted endpoint', async () => {
    const fetcher = vi.fn(async () => new Response('{"debug":"secret-token"}'));
    const gateway = new HttpRemoteTriggerGateway(fetcher as typeof fetch);
    await expect(gateway.execute({ action: 'list' }, settings)).resolves.toEqual({
      status: 200, json: '{"debug":"[REDACTED]"}',
    });
  });

  it('sends an empty JSON object for run and JSON-encodes non-JSON responses', async () => {
    const fetcher = vi.fn(async () => new Response('accepted'));
    const gateway = new HttpRemoteTriggerGateway(fetcher as typeof fetch);
    await expect(gateway.execute({ action: 'run', trigger_id: 'daily' }, settings)).resolves.toEqual({
      status: 200, json: '"accepted"',
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/v1/code/triggers/daily/run', expect.objectContaining({ body: '{}' }));
  });
});
