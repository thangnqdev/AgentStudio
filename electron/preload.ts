import { contextBridge, ipcRenderer } from 'electron';

type ChatEventPayload = {
  requestId: string;
  chunk?: string;
  error?: string;
  action?: ChatActionPayload;
};

type ChatActionPayload = {
  id: string;
  toolName: string;
  args: string;
  status: 'running' | 'ok' | 'error';
  output?: string;
};

type ChatEventListener = (payload: ChatEventPayload) => void;

type TerminalEventPayload = {
  terminalId: string;
  data?: string;
  exitCode?: number;
  signal?: number | string;
};

type TerminalEventListener = (payload: TerminalEventPayload) => void;

type EventChannel = 'ai:chat:chunk' | 'ai:chat:done' | 'ai:chat:error' | 'ai:chat:action';

function subscribe(channel: EventChannel, listener: ChatEventListener) {
  const handler = (_event: Electron.IpcRendererEvent, payload: ChatEventPayload) => {
    listener(payload);
  };

  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.off(channel, handler);
  };
}

function subscribeTerminal(channel: 'terminal:data' | 'terminal:exit', listener: TerminalEventListener) {
  const handler = (_event: Electron.IpcRendererEvent, payload: TerminalEventPayload) => {
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
  getCurrentWorkspace: () => ipcRenderer.invoke('workspace:get-current'),
  selectWorkspace: () => ipcRenderer.invoke('workspace:select-directory'),
  writeWorkspaceFile: (payload: unknown) => ipcRenderer.invoke('workspace:write-file', payload),

  startChat: (payload: unknown) => ipcRenderer.send('ai:chat:start', payload),
  stopChat: (requestId: string) => ipcRenderer.send('ai:chat:stop', { requestId }),
  onChatChunk: (listener: ChatEventListener) => subscribe('ai:chat:chunk', listener),
  onChatAction: (listener: ChatEventListener) => subscribe('ai:chat:action', listener),
  onChatDone: (listener: ChatEventListener) => subscribe('ai:chat:done', listener),
  onChatError: (listener: ChatEventListener) => subscribe('ai:chat:error', listener),

  createTerminal: (payload: unknown) => ipcRenderer.invoke('terminal:create', payload),
  listCommandShells: () => ipcRenderer.invoke('terminal:list-shells'),
  writeTerminal: (payload: unknown) => ipcRenderer.send('terminal:write', payload),
  resizeTerminal: (payload: unknown) => ipcRenderer.send('terminal:resize', payload),
  killTerminal: (terminalId: string) => ipcRenderer.send('terminal:kill', { terminalId }),
  onTerminalData: (listener: TerminalEventListener) => subscribeTerminal('terminal:data', listener),
  onTerminalExit: (listener: TerminalEventListener) => subscribeTerminal('terminal:exit', listener),
});
