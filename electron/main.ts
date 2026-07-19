import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerAppIpc } from './ipc/registerAppIpc.js';
import { registerSettingsIpc } from './ipc/registerSettingsIpc.js';
import { registerWorkspaceIpc } from './ipc/registerWorkspaceIpc.js';
import { registerWorkspaceBrowserIpc } from './ipc/registerWorkspaceBrowserIpc.js';
import { registerGitIpc } from './ipc/registerGitIpc.js';
import { registerTerminalIpc } from './ipc/registerTerminalIpc.js';
import { registerAgentIpc } from './ipc/registerAgentIpc.js';
import { registerAgentWorktreeIpc } from './ipc/registerAgentWorktreeIpc.js';
import { registerAgentWorkerIpc } from './ipc/registerAgentWorkerIpc.js';
import { registerAgentTeamIpc } from './ipc/registerAgentTeamIpc.js';
import { registerKnowledgeIpc } from './ipc/registerKnowledgeIpc.js';
import { registerWebSearchIpc } from './ipc/registerWebSearchIpc.js';
import { registerUpdateIpc } from './ipc/registerUpdateIpc.js';
import { registerStartupIpc } from './ipc/registerStartupIpc.js';
import { registerSkillIpc } from './ipc/registerSkillIpc.js';
import { registerMcpIpc } from './ipc/registerMcpIpc.js';
import { registerTraceIpc } from './ipc/registerTraceIpc.js';
import { registerEvaluationIpc } from './ipc/registerEvaluationIpc.js';
import { registerWorkflowIpc } from './ipc/registerWorkflowIpc.js';
import { registerCapabilityIpc } from './ipc/registerCapabilityIpc.js';
import { registerOptimizerIpc } from './ipc/registerOptimizerIpc.js';
import { registerSkillLearningIpc } from './ipc/registerSkillLearningIpc.js';
import { registerAgentProfileIpc } from './ipc/registerAgentProfileIpc.js';
import { registerPluginIpc } from './ipc/registerPluginIpc.js';
import { registerRemoteTriggerIpc } from './ipc/registerRemoteTriggerIpc.js';
import { registerAttachmentIpc } from './ipc/registerAttachmentIpc.js';
import { registerLifecycleHookIpc } from './ipc/registerLifecycleHookIpc.js';
import { registerManualCompactionIpc } from './ipc/registerManualCompactionIpc.js';
import { terminalManager } from './infrastructure/PtyTerminalManager.js';
import { ElectronAutoUpdater } from './infrastructure/ElectronAutoUpdater.js';
import { SplashWindow } from './infrastructure/SplashWindow.js';
import { configureExternalNavigation } from './infrastructure/ExternalNavigationPolicy.js';
import { stopWorkspaceKnowledgeSync } from './knowledgeRuntime.js';
import { ManageAppUpdate } from './application/usecases/ManageAppUpdate.js';
import { mcpServerManager } from './mcpRuntime.js';
import { workspaceManager } from './infrastructure/WorkspaceManager.js';
import { settingsRepo } from './infrastructure/JsonSettingsRepository.js';
import { HttpProviderModelCatalog } from './infrastructure/providers/HttpProviderModelCatalog.js';
import { ManageProviderSettings } from './application/usecases/ManageProviderSettings.js';
import { randomUUID } from 'node:crypto';
import { backgroundCommandNotifier } from './backgroundCommandRuntime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null = null;
let appUpdate: ManageAppUpdate | null = null;
const splashWindow = new SplashWindow(() => win);
const providerSettings = new ManageProviderSettings(
  settingsRepo,
  new HttpProviderModelCatalog(),
  { createId: randomUUID, defaultWorkspacePath: () => process.cwd() },
);

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'favicon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
    },
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#fdf8f7',
    frame: process.platform !== 'darwin',
    show: false,
  });
  configureExternalNavigation(win);

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'));
  }
}

function registerIpcHandlers() {
  registerAppIpc(win);
  registerSettingsIpc(providerSettings);
  registerWorkspaceIpc(win);
  registerWorkspaceBrowserIpc();
  registerGitIpc();
  registerTerminalIpc();
  registerKnowledgeIpc(win);
  registerAgentIpc();
  registerAgentWorktreeIpc();
  registerAgentWorkerIpc();
  registerAgentTeamIpc();
  registerWebSearchIpc();
  registerSkillIpc();
  registerMcpIpc();
  registerTraceIpc(win);
  registerEvaluationIpc(win);
  registerWorkflowIpc();
  registerCapabilityIpc();
  registerOptimizerIpc();
  registerSkillLearningIpc();
  registerAgentProfileIpc();
  registerPluginIpc();
  registerRemoteTriggerIpc();
  registerAttachmentIpc();
  registerLifecycleHookIpc();
  registerManualCompactionIpc();
  if (appUpdate) registerUpdateIpc(() => win, appUpdate);
  registerStartupIpc(() => win, splashWindow, backgroundCommandNotifier);
}

app.on('window-all-closed', () => {
  terminalManager.killAllTerminals();
  void stopWorkspaceKnowledgeSync();
  void mcpServerManager.stopAll();
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  splashWindow.show();
  createWindow();
  appUpdate = new ManageAppUpdate(new ElectronAutoUpdater());
  registerIpcHandlers();
  void workspaceManager.getWorkspaceRoot().then((workspaceRoot) => mcpServerManager.startAuto(workspaceRoot));
  void appUpdate.checkForUpdates();
});
