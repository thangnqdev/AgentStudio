import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAgentSession, type AgentStartPayload, type PermissionMode } from './agentRuntime.js';

type PublicProvider = {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  hasApiKey: boolean;
};

type PublicSettings = {
  providers: PublicProvider[];
  activeProviderId: string | null;
  activeModelId: string | null;
  permissionMode: PermissionMode;
};

type StoredProvider = {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  encryptedApiKey?: string;
  plainApiKey?: string;
};

type StoredSettings = {
  providers: StoredProvider[];
  activeProviderId: string | null;
  activeModelId: string | null;
  permissionMode: PermissionMode;
};

type SaveProviderPayload = {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
};

type LegacySettingsPayload = {
  providers?: Array<SaveProviderPayload & { models?: string[] }>;
  activeProviderId?: string | null;
  activeModelId?: string | null;
  permissionMode?: PermissionMode;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

const DEFAULT_SETTINGS: StoredSettings = {
  providers: [
    {
      id: 'default-openai',
      name: 'OpenAI (Default)',
      baseUrl: 'https://api.openai.com/v1',
      models: [],
    },
  ],
  activeProviderId: 'default-openai',
  activeModelId: 'gpt-3.5-turbo',
  permissionMode: 'workspace-write',
};

let win: BrowserWindow | null = null;
let settingsCache: StoredSettings | null = null;
const activeAgentControllers = new Map<string, AbortController>();

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
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'));
  }
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function resolveWorkspacePath(inputPath: string) {
  const workspaceRoot = process.cwd();
  const resolved = path.resolve(path.join(workspaceRoot, inputPath));
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${inputPath}`);
  }
  return resolved;
}

function cloneDefaultSettings(): StoredSettings {
  return {
    providers: DEFAULT_SETTINGS.providers.map((provider) => ({ ...provider, models: [...provider.models] })),
    activeProviderId: DEFAULT_SETTINGS.activeProviderId,
    activeModelId: DEFAULT_SETTINGS.activeModelId,
    permissionMode: DEFAULT_SETTINGS.permissionMode,
  };
}

async function loadStoredSettings(): Promise<StoredSettings> {
  if (settingsCache) return settingsCache;

  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    settingsCache = {
      providers: Array.isArray(parsed.providers) ? parsed.providers.map(normalizeStoredProvider) : [],
      activeProviderId: typeof parsed.activeProviderId === 'string' ? parsed.activeProviderId : null,
      activeModelId: typeof parsed.activeModelId === 'string' ? parsed.activeModelId : null,
      permissionMode: normalizePermissionMode(parsed.permissionMode),
    };
  } catch {
    settingsCache = cloneDefaultSettings();
    await saveStoredSettings(settingsCache);
  }

  if (settingsCache.providers.length === 0) {
    settingsCache.activeProviderId = null;
    settingsCache.activeModelId = null;
  }

  return settingsCache;
}

async function saveStoredSettings(settings: StoredSettings) {
  settingsCache = settings;
  await fs.mkdir(path.dirname(getSettingsPath()), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

function normalizeStoredProvider(provider: Partial<StoredProvider>): StoredProvider {
  return {
    id: typeof provider.id === 'string' && provider.id ? provider.id : randomUUID(),
    name: typeof provider.name === 'string' && provider.name ? provider.name : 'Unnamed',
    baseUrl: typeof provider.baseUrl === 'string' ? provider.baseUrl : '',
    models: Array.isArray(provider.models) ? provider.models.filter((model): model is string => typeof model === 'string') : [],
    encryptedApiKey: typeof provider.encryptedApiKey === 'string' ? provider.encryptedApiKey : undefined,
    plainApiKey: typeof provider.plainApiKey === 'string' ? provider.plainApiKey : undefined,
  };
}

function toPublicSettings(settings: StoredSettings): PublicSettings {
  return {
    providers: settings.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      models: provider.models,
      hasApiKey: Boolean(provider.encryptedApiKey || provider.plainApiKey),
    })),
    activeProviderId: settings.activeProviderId,
    activeModelId: settings.activeModelId,
    permissionMode: settings.permissionMode,
  };
}

function normalizePermissionMode(value: unknown): PermissionMode {
  if (value === 'read-only' || value === 'workspace-write' || value === 'danger-full-access') {
    return value;
  }

  return 'workspace-write';
}

function encryptApiKey(apiKey: string): Pick<StoredProvider, 'encryptedApiKey' | 'plainApiKey'> {
  if (!apiKey) return {};

  if (safeStorage.isEncryptionAvailable()) {
    return { encryptedApiKey: safeStorage.encryptString(apiKey).toString('base64') };
  }

  return { plainApiKey: apiKey };
}

function decryptApiKey(provider: StoredProvider): string {
  if (provider.encryptedApiKey) {
    return safeStorage.decryptString(Buffer.from(provider.encryptedApiKey, 'base64'));
  }

  return provider.plainApiKey || '';
}

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new Error('Base URL không được để trống.');
  }

  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL chỉ hỗ trợ HTTP hoặc HTTPS.');
  }

  return url.toString().replace(/\/$/, '');
}

function buildEndpoint(baseUrl: string, endpoint: string) {
  return new URL(endpoint, `${baseUrl.replace(/\/$/, '')}/`).toString();
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

async function fetchAvailableModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(buildEndpoint(baseUrl, 'models'), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (isObject(data) && Array.isArray(data.data)) {
    return data.data.map(readModelId).filter((model): model is string => Boolean(model));
  }

  if (isObject(data) && Array.isArray(data.models)) {
    return data.models.map(readModelId).filter((model): model is string => Boolean(model));
  }

  if (Array.isArray(data)) {
    return data.map(readModelId).filter((model): model is string => Boolean(model));
  }

  throw new Error('Định dạng danh sách model không hợp lệ từ server.');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readModelId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!isObject(value)) return null;

  const id = value.id;
  const name = value.name;
  if (typeof id === 'string') return id;
  if (typeof name === 'string') return name;
  return null;
}

function registerIpcHandlers() {
  ipcMain.handle('ping', () => 'pong');

  ipcMain.handle('settings:load', async () => {
    return toPublicSettings(await loadStoredSettings());
  });

  ipcMain.handle('settings:import-legacy', async (_event, rawPayload: LegacySettingsPayload) => {
    if (!isObject(rawPayload) || !Array.isArray(rawPayload.providers)) {
      return toPublicSettings(await loadStoredSettings());
    }

    const providers = rawPayload.providers.map((provider) => {
      const baseUrl = getString(provider.baseUrl).trim();
      const apiKey = getString(provider.apiKey);

      return {
        id: getString(provider.id) || randomUUID(),
        name: getString(provider.name).trim() || 'Unnamed',
        baseUrl,
        models: getStringArray(provider.models),
        ...encryptApiKey(apiKey),
      };
    });

    const providerIds = new Set(providers.map((provider) => provider.id));
    const activeProviderId = getString(rawPayload.activeProviderId);
    const nextActiveProviderId = providerIds.has(activeProviderId) ? activeProviderId : providers[0]?.id ?? null;
    const activeProvider = providers.find((provider) => provider.id === nextActiveProviderId) ?? null;
    const legacyActiveModelId = getString(rawPayload.activeModelId);
    const settings: StoredSettings = {
      providers,
      activeProviderId: nextActiveProviderId,
      activeModelId: activeProvider?.models.includes(legacyActiveModelId)
        ? legacyActiveModelId
        : activeProvider?.models[0] ?? null,
      permissionMode: normalizePermissionMode(rawPayload.permissionMode),
    };

    await saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:save-provider-and-scan', async (_event, rawPayload: SaveProviderPayload) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const settings = await loadStoredSettings();
    const providerId = getString(payload.id) || randomUUID();
    const existingIndex = settings.providers.findIndex((provider) => provider.id === providerId);
    const existingProvider = existingIndex >= 0 ? settings.providers[existingIndex] : null;
    const baseUrl = normalizeBaseUrl(getString(payload.baseUrl));
    const apiKey = getString(payload.apiKey) || (existingProvider ? decryptApiKey(existingProvider) : '');
    const models = await fetchAvailableModels(baseUrl, apiKey);
    const savedSecret = getString(payload.apiKey) ? encryptApiKey(getString(payload.apiKey)) : {
      encryptedApiKey: existingProvider?.encryptedApiKey,
      plainApiKey: existingProvider?.plainApiKey,
    };
    const nextProvider: StoredProvider = {
      id: providerId,
      name: getString(payload.name).trim() || 'Unnamed',
      baseUrl,
      models,
      ...savedSecret,
    };

    if (existingIndex >= 0) {
      settings.providers[existingIndex] = nextProvider;
    } else {
      settings.providers.push(nextProvider);
    }

    if (!settings.activeProviderId || existingIndex < 0 && settings.providers.length === 1) {
      settings.activeProviderId = nextProvider.id;
    }

    if (settings.activeProviderId === nextProvider.id && !models.includes(settings.activeModelId || '')) {
      settings.activeModelId = models[0] ?? null;
    }

    await saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:delete-provider', async (_event, providerId: string) => {
    const settings = await loadStoredSettings();
    settings.providers = settings.providers.filter((provider) => provider.id !== providerId);

    if (settings.activeProviderId === providerId) {
      const nextProvider = settings.providers[0] ?? null;
      settings.activeProviderId = nextProvider?.id ?? null;
      settings.activeModelId = nextProvider?.models[0] ?? null;
    }

    await saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:set-active-provider', async (_event, providerId: string) => {
    const settings = await loadStoredSettings();
    const provider = settings.providers.find((item) => item.id === providerId);
    if (!provider) throw new Error('Provider không tồn tại.');

    settings.activeProviderId = provider.id;
    if (!provider.models.includes(settings.activeModelId || '')) {
      settings.activeModelId = provider.models[0] ?? null;
    }

    await saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:set-active-model', async (_event, modelId: string) => {
    const settings = await loadStoredSettings();
    settings.activeModelId = modelId || null;
    await saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:set-permission-mode', async (_event, permissionMode: PermissionMode) => {
    const settings = await loadStoredSettings();
    settings.permissionMode = normalizePermissionMode(permissionMode);
    await saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('workspace:write-file', async (_event, rawPayload: { path?: string; content?: string }) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const targetPath = resolveWorkspacePath(getString(payload.path));
    const content = getString(payload.content);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf8');
    return { ok: true, path: path.relative(process.cwd(), targetPath) };
  });

  ipcMain.on('ai:chat:stop', (_event, rawPayload: { requestId?: string }) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const requestId = getString(payload.requestId);
    activeAgentControllers.get(requestId)?.abort();
  });

  ipcMain.on('ai:chat:start', async (event, rawPayload: AgentStartPayload) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const requestId = getString(payload.requestId);

    if (!requestId) {
      event.sender.send('ai:chat:error', { requestId: '', error: 'Thiếu requestId.' });
      return;
    }

    try {
      const controller = new AbortController();
      activeAgentControllers.set(requestId, controller);
      const settings = await loadStoredSettings();
      const activeProvider = settings.providers.find((provider) => provider.id === settings.activeProviderId);
      if (!activeProvider) {
        throw new Error('Chưa cấu hình provider AI.');
      }

      await runAgentSession(payload, event.sender, {
        baseUrl: activeProvider.baseUrl,
        apiKey: decryptApiKey(activeProvider),
        model: settings.activeModelId || '',
        permissionMode: settings.permissionMode,
      }, process.cwd(), controller.signal);
    } catch (error) {
      if (activeAgentControllers.get(requestId)?.signal.aborted) {
        event.sender.send('ai:chat:chunk', { requestId, chunk: '\n\nĐã dừng phản hồi.' });
        event.sender.send('ai:chat:done', { requestId });
      } else {
        event.sender.send('ai:chat:error', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    } finally {
      activeAgentControllers.delete(requestId);
    }
  });
}

app.on('window-all-closed', () => {
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
  registerIpcHandlers();
  createWindow();
});
