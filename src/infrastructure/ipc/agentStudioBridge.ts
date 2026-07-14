import type { Message } from '../../domain/entities/message';
import type { PermissionMode } from '../../domain/entities/settings';
import type { AppUpdateSnapshot } from '../../domain/entities/appUpdate';

// Ensure the types from electron.d.ts are available
// We assume electron.d.ts extends Window

export const AgentBridge = {
  get isAvailable() {
    return typeof window !== 'undefined' && !!window.agentStudio;
  },

  ping() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.ping();
  },

  async getAppVersion() {
    if (!window.agentStudio) return '';
    return window.agentStudio.getAppVersion();
  },

  getPlatform() {
    if (!window.agentStudio) return 'unknown';
    return window.agentStudio.getPlatform();
  },

  minimizeWindow() {
    if (!window.agentStudio) return;
    window.agentStudio.minimizeWindow();
  },

  maximizeWindow() {
    if (!window.agentStudio) return;
    window.agentStudio.maximizeWindow();
  },

  closeWindow() {
    if (!window.agentStudio) return;
    window.agentStudio.closeWindow();
  },

  notifyRendererReady() {
    if (!window.agentStudio) return;
    window.agentStudio.notifyRendererReady();
  },

  async getAppUpdateStatus() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.getAppUpdateStatus();
  },

  async checkForAppUpdates() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.checkForAppUpdates();
  },

  async downloadAppUpdate() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.downloadAppUpdate();
  },

  async installAppUpdate() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.installAppUpdate();
  },

  onAppUpdateStatus(listener: (payload: AppUpdateSnapshot) => void) {
    if (!window.agentStudio) return () => {};
    return window.agentStudio.onAppUpdateStatus(listener);
  },

  async loadSettings() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.loadSettings();
  },

  async importLegacySettings(settings: Parameters<NonNullable<Window['agentStudio']>['importLegacySettings']>[0]) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.importLegacySettings(settings);
  },

  async saveProviderAndScan(provider: Parameters<NonNullable<Window['agentStudio']>['saveProviderAndScan']>[0]) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.saveProviderAndScan(provider);
  },

  async deleteProvider(providerId: string) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.deleteProvider(providerId);
  },

  async setActiveProvider(providerId: string) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.setActiveProvider(providerId);
  },

  async setActiveModel(modelId: string) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.setActiveModel(modelId);
  },

  async setFallbackModel(modelId: string) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.setFallbackModel(modelId);
  },

  async setPermissionMode(mode: PermissionMode) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.setPermissionMode(mode);
  },

  async loadWebSearchSettings() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.loadWebSearchSettings();
  },

  async saveWebSearchSettings(payload: Parameters<NonNullable<Window['agentStudio']>['saveWebSearchSettings']>[0]) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.saveWebSearchSettings(payload);
  },

  async getCurrentWorkspace() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.getCurrentWorkspace();
  },

  async selectWorkspace() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.selectWorkspace();
  },

  async writeWorkspaceFile(payload: Parameters<NonNullable<Window['agentStudio']>['writeWorkspaceFile']>[0]) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.writeWorkspaceFile(payload);
  },

  getFilePath(file: File) {
    if (!window.agentStudio) return '';
    return window.agentStudio.getFilePath(file);
  },

  async loadChatHistory(workspacePath: string) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.loadChatHistory(workspacePath);
  },

  async saveChatHistory(payload: Parameters<NonNullable<Window['agentStudio']>['saveChatHistory']>[0]) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.saveChatHistory(payload);
  },

  async getGitBranch() {
    if (!window.agentStudio) return null;
    return window.agentStudio.getGitBranch();
  },

  async listKnowledge() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.listKnowledge();
  },

  async selectAndImportKnowledge() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.selectAndImportKnowledge();
  },

  async syncWorkspaceKnowledge() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.syncWorkspaceKnowledge();
  },

  async stopWorkspaceKnowledgeSync() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.stopWorkspaceKnowledgeSync();
  },

  async removeKnowledgeDocument(documentId: string) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.removeKnowledgeDocument(documentId);
  },

  startChat(payload: { requestId: string; taskId?: string; messages: Message[] }) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    window.agentStudio.startChat(payload);
  },

  stopChat(requestId: string) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    window.agentStudio.stopChat(requestId);
  },

  respondToToolApproval(payload: { requestId: string; actionId: string; approved: boolean }) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    window.agentStudio.respondToToolApproval(payload);
  },

  onChatChunk(listener: Parameters<NonNullable<Window['agentStudio']>['onChatChunk']>[0]) {
    if (!window.agentStudio) return () => {};
    return window.agentStudio.onChatChunk(listener);
  },

  onChatAction(listener: Parameters<NonNullable<Window['agentStudio']>['onChatAction']>[0]) {
    if (!window.agentStudio) return () => {};
    return window.agentStudio.onChatAction(listener);
  },

  onChatDone(listener: Parameters<NonNullable<Window['agentStudio']>['onChatDone']>[0]) {
    if (!window.agentStudio) return () => {};
    return window.agentStudio.onChatDone(listener);
  },

  onChatError(listener: Parameters<NonNullable<Window['agentStudio']>['onChatError']>[0]) {
    if (!window.agentStudio) return () => {};
    return window.agentStudio.onChatError(listener);
  },

  onChatTaskStatus(listener: Parameters<NonNullable<Window['agentStudio']>['onChatTaskStatus']>[0]) {
    if (!window.agentStudio) return () => {};
    return window.agentStudio.onChatTaskStatus(listener);
  },

  async listResumableAgentTasks() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.listResumableAgentTasks();
  },

  async forkAgentTask(taskId: string) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.forkAgentTask(taskId);
  },

  async listCommandShells() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.listCommandShells();
  },

  async createTerminal(payload: Parameters<NonNullable<Window['agentStudio']>['createTerminal']>[0]) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.createTerminal(payload);
  },

  writeTerminal(payload: Parameters<NonNullable<Window['agentStudio']>['writeTerminal']>[0]) {
    if (!window.agentStudio) return;
    window.agentStudio.writeTerminal(payload);
  },

  resizeTerminal(payload: Parameters<NonNullable<Window['agentStudio']>['resizeTerminal']>[0]) {
    if (!window.agentStudio) return;
    window.agentStudio.resizeTerminal(payload);
  },

  killTerminal(terminalId: string) {
    if (!window.agentStudio) return;
    window.agentStudio.killTerminal(terminalId);
  },

  onTerminalData(listener: Parameters<NonNullable<Window['agentStudio']>['onTerminalData']>[0]) {
    if (!window.agentStudio) return () => {};
    return window.agentStudio.onTerminalData(listener);
  },

  onTerminalExit(listener: Parameters<NonNullable<Window['agentStudio']>['onTerminalExit']>[0]) {
    if (!window.agentStudio) return () => {};
    return window.agentStudio.onTerminalExit(listener);
  }
};
