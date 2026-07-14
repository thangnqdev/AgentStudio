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
type AppUpdateSnapshot = {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error' | 'unsupported';
  version?: string;
  progress?: number;
  message?: string;
};
type AppUpdateEventListener = (payload: AppUpdateSnapshot) => void;

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

function subscribeAppUpdate(listener: AppUpdateEventListener) {
  const handler = (_event: Electron.IpcRendererEvent, payload: AppUpdateSnapshot) => listener(payload);
  ipcRenderer.on('update:status', handler);
  return () => ipcRenderer.off('update:status', handler);
}

contextBridge.exposeInMainWorld('agentStudio', {
  ping: () => ipcRenderer.invoke('ping'),

  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getPlatform: () => process.platform,
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  notifyRendererReady: () => ipcRenderer.send('app:renderer-ready'),
  getAppUpdateStatus: () => ipcRenderer.invoke('update:get-status'),
  checkForAppUpdates: () => ipcRenderer.invoke('update:check'),
  downloadAppUpdate: () => ipcRenderer.invoke('update:download'),
  installAppUpdate: () => ipcRenderer.invoke('update:install'),
  onAppUpdateStatus: (listener: AppUpdateEventListener) => subscribeAppUpdate(listener),

  loadSettings: () => ipcRenderer.invoke('settings:load'),
  importLegacySettings: (settings: unknown) => ipcRenderer.invoke('settings:import-legacy', settings),
  saveProvider: (provider: unknown) => ipcRenderer.invoke('settings:save-provider', provider),
  saveProviderAndScan: (provider: unknown) => ipcRenderer.invoke('settings:save-provider-and-scan', provider),
  deleteProvider: (providerId: string) => ipcRenderer.invoke('settings:delete-provider', providerId),
  setActiveProvider: (providerId: string) => ipcRenderer.invoke('settings:set-active-provider', providerId),
  setActiveModel: (modelId: string) => ipcRenderer.invoke('settings:set-active-model', modelId),
  setFallbackModel: (modelId: string) => ipcRenderer.invoke('settings:set-fallback-model', modelId),
  setPermissionMode: (mode: string) => ipcRenderer.invoke('settings:set-permission-mode', mode),
  loadWebSearchSettings: () => ipcRenderer.invoke('web-search:load-settings'),
  saveWebSearchSettings: (payload: unknown) => ipcRenderer.invoke('web-search:save-settings', payload),
  getCurrentWorkspace: () => ipcRenderer.invoke('workspace:get-current'),
  selectWorkspace: () => ipcRenderer.invoke('workspace:select-directory'),
  writeWorkspaceFile: (payload: unknown) => ipcRenderer.invoke('workspace:write-file', payload),
  getFilePath: (file: unknown) => webUtils.getPathForFile(file as File),
  loadChatHistory: (workspacePath: string) => ipcRenderer.invoke('chat:load-workspace', workspacePath),
  saveChatHistory: (payload: unknown) => ipcRenderer.invoke('chat:save-workspace', payload),
  getGitBranch: () => ipcRenderer.invoke('git:get-branch'),
  listKnowledge: () => ipcRenderer.invoke('knowledge:list'),
  selectAndImportKnowledge: () => ipcRenderer.invoke('knowledge:select-and-import'),
  syncWorkspaceKnowledge: () => ipcRenderer.invoke('knowledge:sync-workspace'),
  stopWorkspaceKnowledgeSync: () => ipcRenderer.invoke('knowledge:stop-workspace-sync'),
  removeKnowledgeDocument: (documentId: string) => ipcRenderer.invoke('knowledge:remove', documentId),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  setSkillEnabled: (payload: unknown) => ipcRenderer.invoke('skills:set-enabled', payload),
  setSkillTrusted: (payload: unknown) => ipcRenderer.invoke('skills:set-trusted', payload),
  listAgentProfiles: () => ipcRenderer.invoke('agent-profiles:list'),
  setAgentProfileEnabled: (payload: unknown) => ipcRenderer.invoke('agent-profiles:set-enabled', payload),
  setAgentProfileTrusted: (payload: unknown) => ipcRenderer.invoke('agent-profiles:set-trusted', payload),
  listPlugins: () => ipcRenderer.invoke('plugins:list'),
  setPluginEnabled: (payload: unknown) => ipcRenderer.invoke('plugins:set-enabled', payload),
  setPluginTrusted: (payload: unknown) => ipcRenderer.invoke('plugins:set-trusted', payload),
  listMcpServers: () => ipcRenderer.invoke('mcp:list'),
  saveMcpServer: (payload: unknown) => ipcRenderer.invoke('mcp:save', payload),
  removeMcpServer: (serverId: string) => ipcRenderer.invoke('mcp:remove', serverId),
  startMcpServer: (serverId: string) => ipcRenderer.invoke('mcp:start', serverId),
  stopMcpServer: (serverId: string) => ipcRenderer.invoke('mcp:stop', serverId),

  startChat: (payload: unknown) => ipcRenderer.send('ai:chat:start', payload),
  stopChat: (requestId: string) => ipcRenderer.send('ai:chat:stop', { requestId }),
  respondToToolApproval: (payload: unknown) => ipcRenderer.send('ai:chat:tool-approval', payload),
  onChatChunk: (listener: ChatEventListener) => subscribe('ai:chat:chunk', listener),
  onChatAction: (listener: ChatEventListener) => subscribe('ai:chat:action', listener),
  onChatDone: (listener: ChatEventListener) => subscribe('ai:chat:done', listener),
  onChatError: (listener: ChatEventListener) => subscribe('ai:chat:error', listener),
  onChatTaskStatus: (listener: ChatEventListener) => subscribe('ai:chat:task-status', listener),
  listResumableAgentTasks: () => ipcRenderer.invoke('agent:tasks:list-resumable'),
  forkAgentTask: (taskId: string) => ipcRenderer.invoke('agent:tasks:fork', { taskId }),
  listAgentTraces: (limit?: number) => ipcRenderer.invoke('traces:list', limit),
  getAgentTrace: (traceId: string) => ipcRenderer.invoke('traces:get', traceId),
  exportAgentTrace: (traceId: string) => ipcRenderer.invoke('traces:export', traceId),
  listAgentEvaluations: (limit?: number) => ipcRenderer.invoke('evaluations:list', limit),
  runGoldenAgentEvaluation: (candidateId?: string) => ipcRenderer.invoke('evaluations:run-golden', candidateId),
  exportAgentEvaluation: (runId: string) => ipcRenderer.invoke('evaluations:export', runId),
  listWorkflowDefinitions: () => ipcRenderer.invoke('workflows:list-definitions'),
  listWorkflowRuns: (limit?: number) => ipcRenderer.invoke('workflows:list-runs', limit),
  startWorkflow: (workflowId: string) => ipcRenderer.invoke('workflows:start', workflowId),
  resumeWorkflow: (payload: unknown) => ipcRenderer.invoke('workflows:resume', payload),
  listCapabilities: () => ipcRenderer.invoke('capabilities:list'),
  recommendCapabilities: (payload: unknown) => ipcRenderer.invoke('capabilities:recommend', payload),
  getOptimizerState: () => ipcRenderer.invoke('optimizer:get-state'),
  createOptimizationCandidate: (payload: unknown) => ipcRenderer.invoke('optimizer:create-candidate', payload),
  evaluateOptimizationCandidate: (payload: unknown) => ipcRenderer.invoke('optimizer:evaluate-candidate', payload),
  promoteOptimizationCandidate: (candidateId: string) => ipcRenderer.invoke('optimizer:promote', candidateId),
  rollbackOptimization: () => ipcRenderer.invoke('optimizer:rollback'),
  listSkillCandidates: () => ipcRenderer.invoke('skill-learning:list'),
  createSkillCandidate: (traceId: string) => ipcRenderer.invoke('skill-learning:create', traceId),
  evaluateSkillCandidate: (candidateId: string) => ipcRenderer.invoke('skill-learning:evaluate', candidateId),
  decideSkillCandidate: (payload: unknown) => ipcRenderer.invoke('skill-learning:decide', payload),
  promoteSkillCandidate: (candidateId: string) => ipcRenderer.invoke('skill-learning:promote', candidateId),

  createTerminal: (payload: unknown) => ipcRenderer.invoke('terminal:create', payload),
  listCommandShells: () => ipcRenderer.invoke('terminal:list-shells'),
  writeTerminal: (payload: unknown) => ipcRenderer.send('terminal:write', payload),
  resizeTerminal: (payload: unknown) => ipcRenderer.send('terminal:resize', payload),
  killTerminal: (terminalId: string) => ipcRenderer.send('terminal:kill', { terminalId }),
  onTerminalData: (listener: TerminalEventListener) => subscribeTerminal('terminal:data', listener),
  onTerminalExit: (listener: TerminalEventListener) => subscribeTerminal('terminal:exit', listener),
});
