import { contextBridge, ipcRenderer, webUtils } from 'electron';

type ChatEventPayload = {
  requestId: string;
  chunk?: string;
  error?: string;
  action?: ChatActionPayload;
  task?: ChatTaskStatusPayload;
};

type ChatActionPayload = {
  id: string;
  toolName: string;
  args: string;
  risk: 'read' | 'write' | 'execute' | 'network';
  status: 'awaiting_approval' | 'denied' | 'running' | 'ok' | 'error';
  output?: string;
};

type ChatTaskStatusPayload = {
  taskId: string;
  status: 'paused' | 'completed';
  completedSteps: number;
};

type ChatEventListener = (payload: ChatEventPayload) => void;

type TerminalEventPayload = {
  terminalId: string;
  data?: string;
  exitCode?: number;
  signal?: number | string;
};

type TerminalEventListener = (payload: TerminalEventPayload) => void;

type EventChannel = 'ai:chat:chunk' | 'ai:chat:done' | 'ai:chat:error' | 'ai:chat:action' | 'ai:chat:task-status';

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

  getPlatform: () => process.platform,
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  loadSettings: () => ipcRenderer.invoke('settings:load'),
  importLegacySettings: (settings: unknown) => ipcRenderer.invoke('settings:import-legacy', settings),
  saveProviderAndScan: (provider: unknown) => ipcRenderer.invoke('settings:save-provider-and-scan', provider),
  deleteProvider: (providerId: string) => ipcRenderer.invoke('settings:delete-provider', providerId),
  setActiveProvider: (providerId: string) => ipcRenderer.invoke('settings:set-active-provider', providerId),
  setActiveModel: (modelId: string) => ipcRenderer.invoke('settings:set-active-model', modelId),
  setPermissionMode: (mode: string) => ipcRenderer.invoke('settings:set-permission-mode', mode),
  loadWebSearchSettings: () => ipcRenderer.invoke('web-search:load-settings'),
  saveWebSearchSettings: (payload: unknown) => ipcRenderer.invoke('web-search:save-settings', payload),
  getCurrentWorkspace: () => ipcRenderer.invoke('workspace:get-current'),
  selectWorkspace: () => ipcRenderer.invoke('workspace:select-directory'),
  writeWorkspaceFile: (payload: unknown) => ipcRenderer.invoke('workspace:write-file', payload),
  getFilePath: (file: unknown) => webUtils.getPathForFile(file as File),
  loadChatHistory: (workspacePath: string) => ipcRenderer.invoke('chat:load-workspace', workspacePath),
  saveChatHistory: (payload: unknown) => ipcRenderer.invoke('chat:save-workspace', payload),
  getGitBranch: (workspacePath: string) => ipcRenderer.invoke('git:get-branch', workspacePath),
  listKnowledge: () => ipcRenderer.invoke('knowledge:list'),
  selectAndImportKnowledge: () => ipcRenderer.invoke('knowledge:select-and-import'),
  syncWorkspaceKnowledge: () => ipcRenderer.invoke('knowledge:sync-workspace'),
  stopWorkspaceKnowledgeSync: () => ipcRenderer.invoke('knowledge:stop-workspace-sync'),
  removeKnowledgeDocument: (documentId: string) => ipcRenderer.invoke('knowledge:remove', documentId),

  startChat: (payload: unknown) => ipcRenderer.send('ai:chat:start', payload),
  stopChat: (requestId: string) => ipcRenderer.send('ai:chat:stop', { requestId }),
  respondToToolApproval: (payload: unknown) => ipcRenderer.send('ai:chat:tool-approval', payload),
  onChatChunk: (listener: ChatEventListener) => subscribe('ai:chat:chunk', listener),
  onChatAction: (listener: ChatEventListener) => subscribe('ai:chat:action', listener),
  onChatDone: (listener: ChatEventListener) => subscribe('ai:chat:done', listener),
  onChatError: (listener: ChatEventListener) => subscribe('ai:chat:error', listener),
  onChatTaskStatus: (listener: ChatEventListener) => subscribe('ai:chat:task-status', listener),
  listResumableAgentTasks: () => ipcRenderer.invoke('agent:tasks:list-resumable'),

  createTerminal: (payload: unknown) => ipcRenderer.invoke('terminal:create', payload),
  listCommandShells: () => ipcRenderer.invoke('terminal:list-shells'),
  writeTerminal: (payload: unknown) => ipcRenderer.send('terminal:write', payload),
  resizeTerminal: (payload: unknown) => ipcRenderer.send('terminal:resize', payload),
  killTerminal: (terminalId: string) => ipcRenderer.send('terminal:kill', { terminalId }),
  onTerminalData: (listener: TerminalEventListener) => subscribeTerminal('terminal:data', listener),
  onTerminalExit: (listener: TerminalEventListener) => subscribeTerminal('terminal:exit', listener),
});
