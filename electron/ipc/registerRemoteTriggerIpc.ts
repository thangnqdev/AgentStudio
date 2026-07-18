import { ipcMain } from 'electron';
import { remoteTriggerSettings } from '../remoteTriggerRuntime.js';

export function registerRemoteTriggerIpc() {
  ipcMain.handle('remote-trigger:load-settings', async () => {
    try {
      return { success: true as const, data: await remoteTriggerSettings.load() };
    } catch (error) {
      return { success: false as const, error: message(error, 'Unable to load RemoteTrigger settings.') };
    }
  });

  ipcMain.handle('remote-trigger:save-settings', async (_event, rawPayload: unknown) => {
    try {
      const payload = isObject(rawPayload) ? rawPayload : {};
      const unknown = Object.keys(payload).filter((key) => !['enabled', 'baseUrl', 'bearerToken', 'clearBearerToken'].includes(key));
      if (unknown.length) throw new Error(`Unknown RemoteTrigger setting field(s): ${unknown.join(', ')}.`);
      if (typeof payload.enabled !== 'boolean') throw new Error('enabled must be a boolean.');
      return {
        success: true as const,
        data: await remoteTriggerSettings.save({
          enabled: payload.enabled,
          baseUrl: optionalString(payload.baseUrl, 'baseUrl'),
          bearerToken: optionalString(payload.bearerToken, 'bearerToken'),
          clearBearerToken: optionalBoolean(payload.clearBearerToken, 'clearBearerToken'),
        }),
      };
    } catch (error) {
      return { success: false as const, error: message(error, 'Unable to save RemoteTrigger settings.') };
    }
  });
}

function optionalString(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  return value;
}
function optionalBoolean(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean.`);
  return value;
}
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
