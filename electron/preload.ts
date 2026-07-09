import { contextBridge, ipcRenderer } from 'electron';

type ChatEventPayload = {
  requestId: string;
  chunk?: string;
  error?: string;
};

type ChatEventListener = (payload: ChatEventPayload) => void;

function subscribe(channel: 'ai:chat:chunk' | 'ai:chat:done' | 'ai:chat:error', listener: ChatEventListener) {
  const handler = (_event: Electron.IpcRendererEvent, payload: ChatEventPayload) => {
    listener(payload);
  };

  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.off(channel, handler);
  };
}

contextBridge.exposeInMainWorld('agentStudio', {
  ping: () => ipcRenderer.invoke('ping'),

  loadSettings: () => ipcRenderer.invoke('settings:load'),
  importLegacySettings: (settings: unknown) => ipcRenderer.invoke('settings:import-legacy', settings),
  saveProviderAndScan: (provider: unknown) => ipcRenderer.invoke('settings:save-provider-and-scan', provider),
  deleteProvider: (providerId: string) => ipcRenderer.invoke('settings:delete-provider', providerId),
  setActiveProvider: (providerId: string) => ipcRenderer.invoke('settings:set-active-provider', providerId),
  setActiveModel: (modelId: string) => ipcRenderer.invoke('settings:set-active-model', modelId),
  setPermissionMode: (mode: string) => ipcRenderer.invoke('settings:set-permission-mode', mode),
  writeWorkspaceFile: (payload: unknown) => ipcRenderer.invoke('workspace:write-file', payload),

  startChat: (payload: unknown) => ipcRenderer.send('ai:chat:start', payload),
  stopChat: (requestId: string) => ipcRenderer.send('ai:chat:stop', { requestId }),
  onChatChunk: (listener: ChatEventListener) => subscribe('ai:chat:chunk', listener),
  onChatDone: (listener: ChatEventListener) => subscribe('ai:chat:done', listener),
  onChatError: (listener: ChatEventListener) => subscribe('ai:chat:error', listener),
});
