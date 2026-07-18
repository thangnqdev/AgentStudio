import { describe, expect, it, vi } from 'vitest';
import { ManageRemoteTriggerSettings } from './ManageRemoteTriggerSettings.js';

describe('ManageRemoteTriggerSettings', () => {
  it('requires complete explicit configuration when enabling and retains an existing token', async () => {
    const repository = {
      load: vi.fn(async () => ({ enabled: false, baseUrl: 'https://old.example.com', bearerToken: 'kept' })),
      save: vi.fn(async () => undefined),
    };
    const manager = new ManageRemoteTriggerSettings(repository);
    await expect(manager.save({ enabled: true, baseUrl: 'https://api.example.com' })).resolves.toEqual({
      enabled: true, baseUrl: 'https://api.example.com', hasBearerToken: true,
    });
    expect(repository.save).toHaveBeenCalledWith({ enabled: true, baseUrl: 'https://api.example.com', bearerToken: 'kept' });
    await expect(manager.save({ enabled: true })).rejects.toThrow('Base URL is required');
  });

  it('can explicitly clear a token only while disabled', async () => {
    const repository = { load: vi.fn(async () => ({ enabled: false, bearerToken: 'old' })), save: vi.fn(async () => undefined) };
    const manager = new ManageRemoteTriggerSettings(repository);
    await expect(manager.save({ enabled: false, clearBearerToken: true })).resolves.toEqual({ enabled: false, hasBearerToken: false });
  });
});
