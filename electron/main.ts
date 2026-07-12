import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerAppIpc } from './ipc/registerAppIpc.js';
import { registerSettingsIpc } from './ipc/registerSettingsIpc.js';
import { registerWorkspaceIpc } from './ipc/registerWorkspaceIpc.js';
import { registerGitIpc } from './ipc/registerGitIpc.js';
import { registerTerminalIpc } from './ipc/registerTerminalIpc.js';
import { registerAgentIpc } from './ipc/registerAgentIpc.js';
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
import { terminalManager } from './infrastructure/PtyTerminalManager.js';
import { ElectronAutoUpdater } from './infrastructure/ElectronAutoUpdater.js';
import { SplashWindow } from './infrastructure/SplashWindow.js';
import { configureExternalNavigation } from './infrastructure/ExternalNavigationPolicy.js';
import { stopWorkspaceKnowledgeSync } from './knowledgeRuntime.js';
import { ManageAppUpdate } from './application/usecases/ManageAppUpdate.js';
import { mcpServerManager } from './mcpRuntime.js';
import { workspaceManager } from './infrastructure/WorkspaceManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null = null;
let appUpdate: ManageAppUpdate | null = null;
const splashWindow = new SplashWindow(() => win);

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'favicon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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
  registerSettingsIpc();
  registerWorkspaceIpc(win);
  registerGitIpc();
  registerTerminalIpc();
  registerKnowledgeIpc(win);
  registerAgentIpc();
  registerWebSearchIpc();
  registerSkillIpc();
  registerMcpIpc();
  registerTraceIpc(win);
  registerEvaluationIpc(win);
  registerWorkflowIpc();
  registerCapabilityIpc();
  registerOptimizerIpc();
  if (appUpdate) registerUpdateIpc(() => win, appUpdate);
  registerStartupIpc(() => win, splashWindow);
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
