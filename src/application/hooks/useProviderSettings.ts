import { useState } from 'react';
import { ProviderSettingsBridge } from '../../infrastructure/ipc/providerSettingsBridge';
import { useAppStore } from '../../store/useAppStore';
import type { AppSettings, PermissionMode } from '../../domain/entities/settings';

/**
 * Hook adapter cho các thao tác quản lý AI provider và model settings.
 * Tách biệt components khỏi AgentBridge trực tiếp — đúng theo Clean Architecture.
 */
export function useProviderSettings() {
  const setSettings = useAppStore((s) => s.setSettings);
  const [settingsNotice, setSettingsNotice] = useState('');

  const setActiveModel = async (modelId: string): Promise<void> => {
    setSettingsNotice('');
    try {
      if (!ProviderSettingsBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await ProviderSettingsBridge.setActiveModel(modelId);
      setSettings(nextSettings);
    } catch (error) {
      setSettingsNotice(messageFrom(error, 'Không thể đổi model.'));
      console.error('Failed to save active model', error);
    }
  };

  const setFallbackModel = async (modelId: string): Promise<void> => {
    setSettingsNotice('');
    try {
      if (!ProviderSettingsBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await ProviderSettingsBridge.setFallbackModel(modelId);
      setSettings(nextSettings);
    } catch (error) {
      setSettingsNotice(messageFrom(error, 'Không thể đổi fallback model.'));
      console.error('Failed to save fallback model', error);
    }
  };

  const setPermissionMode = async (permissionMode: PermissionMode): Promise<void> => {
    setSettingsNotice('');
    try {
      if (!ProviderSettingsBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await ProviderSettingsBridge.setPermissionMode(permissionMode);
      setSettings(nextSettings);
    } catch (error) {
      setSettingsNotice(messageFrom(error, 'Không thể đổi permission mode.'));
      console.error('Failed to save permission mode', error);
    }
  };

  const setActiveProvider = async (id: string): Promise<void> => {
    try {
      if (!ProviderSettingsBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await ProviderSettingsBridge.setActiveProvider(id);
      setSettings(nextSettings);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Không thể chọn provider.');
    }
  };

  const deleteProvider = async (id: string): Promise<void> => {
    try {
      if (!ProviderSettingsBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await ProviderSettingsBridge.deleteProvider(id);
      setSettings(nextSettings);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Không thể xóa provider.');
    }
  };

  const saveProviderAndScan = async (payload: {
    id?: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
  }): Promise<AppSettings> => {
    try {
      if (!ProviderSettingsBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await ProviderSettingsBridge.saveProviderAndScan(payload);
      setSettings(nextSettings);
      return nextSettings;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Không thể lưu provider.');
    }
  };

  const saveProvider = async (payload: {
    id?: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    models?: Array<{ id: string; contextWindow?: number }>;
  }): Promise<AppSettings> => {
    try {
      if (!ProviderSettingsBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const result = await ProviderSettingsBridge.saveProvider(payload);
      if (!result.success) throw new Error(result.error);
      setSettings(result.data);
      return result.data;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Không thể lưu provider.');
    }
  };

  return {
    setActiveModel,
    setFallbackModel,
    setPermissionMode,
    setActiveProvider,
    deleteProvider,
    saveProvider,
    saveProviderAndScan,
    settingsNotice,
  };
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
