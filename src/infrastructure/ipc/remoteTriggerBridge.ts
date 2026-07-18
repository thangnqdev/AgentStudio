export const RemoteTriggerBridge = {
  async loadSettings() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.loadRemoteTriggerSettings();
  },

  async saveSettings(payload: Parameters<NonNullable<Window['agentStudio']>['saveRemoteTriggerSettings']>[0]) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.saveRemoteTriggerSettings(payload);
  },
};
