import type { Message } from '../../domain/entities/message';
import type { PermissionMode } from '../../domain/entities/settings';

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

  async setPermissionMode(mode: PermissionMode) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.setPermissionMode(mode);
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

  async getGitBranch(workspacePath: string) {
    if (!window.agentStudio) return null;
    return window.agentStudio.getGitBranch(workspacePath);
  },

  startChat(payload: { requestId: string; messages: Message[] }) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    window.agentStudio.startChat(payload);
  },

  stopChat(requestId: string) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    window.agentStudio.stopChat(requestId);
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
