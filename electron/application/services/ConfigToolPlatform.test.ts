import { describe, expect, it, vi } from 'vitest';
import type { StoredSettings } from '../../domain/entities/settings.js';
import type { ISettingsRepository } from '../../domain/ports/ISettingsRepository.js';
import { ManageAgentConfig } from '../usecases/ManageAgentConfig.js';
import { ConfigToolPlatform } from './ConfigToolPlatform.js';

function harness() {
  let settings: StoredSettings = {
    providers: [{
      id: 'provider', name: 'Provider', baseUrl: 'https://provider.invalid', plainApiKey: 'secret-value',
      models: [{ id: 'model-a' }, { id: 'model-b' }],
    }],
    activeProviderId: 'provider', activeModelId: 'model-a', fallbackModelId: null,
    permissionMode: 'workspace-write', workspacePath: '/workspace',
  };
  const repository: ISettingsRepository = {
    loadStoredSettings: async () => structuredClone(settings),
    saveStoredSettings: async (next) => { settings = structuredClone(next); },
    encryptApiKey: () => ({}), decryptApiKey: () => 'secret-value',
  };
  const base = {
    list: vi.fn(async () => [{ name: 'base', description: 'base', risk: 'read' as const, parameters: {} }]),
    execute: vi.fn(async () => ({ ok: true, output: 'base' })),
  };
  const onChanged = vi.fn();
  const dispatch = vi.fn(async () => ({ matchedHookIds: [], contexts: [], auditLabels: [] }));
  return {
    platform: new ConfigToolPlatform(base, base, new ManageAgentConfig(repository), onChanged, { dispatch }),
    base, onChanged, dispatch,
  };
}

describe('ConfigToolPlatform', () => {
  it('adds one deferred strict Config tool and delegates other tools', async () => {
    const { platform, base } = harness();
    expect(await platform.list('/workspace')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Config', risk: 'write', deferLoading: true, concurrencySafe: false,
        parameters: expect.objectContaining({ additionalProperties: false, required: ['setting'] }),
      }),
    ]));
    expect(await platform.execute('base', {}, '/workspace', 'read-only')).toEqual({ ok: true, output: 'base' });
    expect(base.execute).toHaveBeenCalledOnce();
  });

  it('keeps secrets out of reads and publishes successful mutations only', async () => {
    const { platform, onChanged, dispatch } = harness();
    const read = await platform.execute('Config', { setting: 'model' }, '/workspace', 'read-only');
    expect(JSON.parse(read.output)).toEqual({
      success: true, operation: 'get', setting: 'model', value: 'model-a', options: ['model-a', 'model-b'],
    });
    expect(read.output).not.toContain('secret-value');
    expect(onChanged).not.toHaveBeenCalled();

    const write = await platform.execute('Config', { setting: 'model', value: 'model-b' }, '/workspace', 'workspace-write');
    expect(JSON.parse(write.output)).toMatchObject({
      success: true, operation: 'set', setting: 'model', previousValue: 'model-a', newValue: 'model-b',
    });
    expect(write.output).not.toContain('secret-value');
    expect(onChanged).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      event: 'ConfigChange', workspaceRoot: '/workspace', matchValue: 'model', toolName: 'Config',
    }));
  });
});
