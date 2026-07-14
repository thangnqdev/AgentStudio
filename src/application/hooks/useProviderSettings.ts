import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';
import { useAppStore } from '../../store/useAppStore';
import type { AppSettings, PermissionMode } from '../../domain/entities/settings';

/**
 * Hook adapter cho các thao tác quản lý AI provider và model settings.
 * Tách biệt components khỏi AgentBridge trực tiếp — đúng theo Clean Architecture.
 */
export function useProviderSettings() {
  const setSettings = useAppStore((s) => s.setSettings);

  const setActiveModel = async (modelId: string): Promise<void> => {
    setSettings({ activeModelId: modelId });
    try {
      if (!AgentBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await AgentBridge.setActiveModel(modelId);
      setSettings(nextSettings);
    } catch (error) {
      console.error('Failed to save active model', error);
    }
  };

  const setPermissionMode = async (permissionMode: PermissionMode): Promise<void> => {
    setSettings({ permissionMode });
    try {
      if (!AgentBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await AgentBridge.setPermissionMode(permissionMode);
      setSettings(nextSettings);
    } catch (error) {
      console.error('Failed to save permission mode', error);
    }
  };

  const setActiveProvider = async (id: string): Promise<void> => {
    try {
      if (!AgentBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await AgentBridge.setActiveProvider(id);
      setSettings(nextSettings);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Không thể chọn provider.');
    }
  };

  const deleteProvider = async (id: string): Promise<void> => {
    try {
      if (!AgentBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await AgentBridge.deleteProvider(id);
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
      if (!AgentBridge.isAvailable) throw new Error('Electron bridge is not available.');
      const nextSettings = await AgentBridge.saveProviderAndScan(payload);
      setSettings(nextSettings);
      return nextSettings;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Không thể lưu provider.');
    }
  };

  return { setActiveModel, setPermissionMode, setActiveProvider, deleteProvider, saveProviderAndScan };
}
