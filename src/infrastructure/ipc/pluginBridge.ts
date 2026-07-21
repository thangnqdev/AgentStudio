function bridge() {
  if (!window.agentStudio) throw new Error('Electron bridge is not available.');
  return window.agentStudio;
}

export const PluginBridge = {
  list: () => bridge().listPlugins(),
  setEnabled: (payload: Parameters<NonNullable<Window['agentStudio']>['setPluginEnabled']>[0]) => bridge().setPluginEnabled(payload),
  setTrusted: (payload: Parameters<NonNullable<Window['agentStudio']>['setPluginTrusted']>[0]) => bridge().setPluginTrusted(payload),
  install: () => bridge().installPlugin(),
  remove: (pluginId: string) => bridge().removePlugin(pluginId),
};
