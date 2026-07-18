export const LifecycleHookBridge = {
  list() {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.listLifecycleHooks();
  },
};
