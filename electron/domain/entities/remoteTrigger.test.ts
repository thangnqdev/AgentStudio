import { describe, expect, it } from 'vitest';
import { normalizeRemoteTriggerBaseUrl, parseRemoteTriggerInput } from './remoteTrigger.js';

describe('remoteTrigger contract', () => {
  it('strictly validates action-specific inputs and body size', () => {
    expect(parseRemoteTriggerInput({ action: 'update', trigger_id: 'daily-1', body: { prompt: 'go' } })).toEqual({ action: 'update', trigger_id: 'daily-1', body: { prompt: 'go' } });
    expect(() => parseRemoteTriggerInput({ action: 'get' })).toThrow('requires trigger_id');
    expect(() => parseRemoteTriggerInput({ action: 'run', trigger_id: '../x' })).toThrow('only letters');
    expect(() => parseRemoteTriggerInput({ action: 'create', body: { value: 'x'.repeat(100_001) } })).toThrow('100,000-byte');
  });

  it('allows HTTPS and loopback HTTP but rejects credential-bearing or insecure URLs', () => {
    expect(normalizeRemoteTriggerBaseUrl('https://api.example.com/')).toBe('https://api.example.com');
    expect(normalizeRemoteTriggerBaseUrl('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
    expect(() => normalizeRemoteTriggerBaseUrl('http://example.com')).toThrow('requires HTTPS');
    expect(() => normalizeRemoteTriggerBaseUrl('https://user:pass@example.com')).toThrow('must not contain credentials');
  });
});
