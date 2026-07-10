import { app, BrowserWindow, dialog, ipcMain, safeStorage, type OpenDialogOptions } from 'electron';
import { spawn as spawnChild } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn as spawnPty } from 'node-pty';
import { runAgentSession, type AgentStartPayload, type PermissionMode } from './agentRuntime.js';

type PublicProvider = {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelMetadata[];
  hasApiKey: boolean;
};

type PublicSettings = {
  providers: PublicProvider[];
  activeProviderId: string | null;
  activeModelId: string | null;
  permissionMode: PermissionMode;
  workspacePath: string;
};

type StoredProvider = {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelMetadata[];
  encryptedApiKey?: string;
  plainApiKey?: string;
};

type StoredSettings = {
  providers: StoredProvider[];
  activeProviderId: string | null;
  activeModelId: string | null;
  permissionMode: PermissionMode;
  workspacePath: string;
};

type SaveProviderPayload = {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
};

type ModelMetadata = {
  id: string;
  contextWindow?: number;
};

type LegacySettingsPayload = {
  providers?: Array<SaveProviderPayload & { models?: unknown[] }>;
  activeProviderId?: string | null;
  activeModelId?: string | null;
  permissionMode?: PermissionMode;
};

type ChatHistoryPayload = {
  workspacePath?: string;
  threads?: unknown[];
  activeThreadId?: string | null;
};

type TerminalCreatePayload = {
  cols?: number;
  rows?: number;
  shellId?: string;
};

type TerminalTargetPayload = {
  terminalId?: string;
};

type TerminalWritePayload = TerminalTargetPayload & {
  data?: string;
};

type TerminalResizePayload = TerminalTargetPayload & {
  cols?: number;
  rows?: number;
};

type TerminalProcess = {
  cols: number;
  rows: number;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
};

type CommandShell = {
  id: string;
  label: string;
  command: string;
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
  workspacePath: process.cwd(),
};

let win: BrowserWindow | null = null;
let settingsCache: StoredSettings | null = null;
const activeAgentControllers = new Map<string, AbortController>();
const activeTerminals = new Map<string, TerminalProcess>();

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

function getChatHistoryDir() {
  return path.join(app.getPath('userData'), 'chat-history');
}

function getChatHistoryPath(workspacePath: string) {
  const normalizedPath = path.resolve(workspacePath || process.cwd());
  const hash = createHash('sha256').update(normalizedPath).digest('hex').slice(0, 24);
  return path.join(getChatHistoryDir(), `${hash}.json`);
}

async function getWorkspaceRoot() {
  const settings = await loadStoredSettings();
  return settings.workspacePath || process.cwd();
}

async function resolveWorkspacePath(inputPath: string) {
  const workspaceRoot = await getWorkspaceRoot();
  const resolved = path.resolve(path.join(workspaceRoot, inputPath));
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${inputPath}`);
  }
  return resolved;
}

function buildTerminalEnv() {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';
  return env;
}

async function getAvailableCommandShells(): Promise<CommandShell[]> {
  const candidates = process.platform === 'win32'
    ? getWindowsShellCandidates()
    : getUnixShellCandidates();
  const shells: CommandShell[] = [];
  const seenCommands = new Set<string>();

  for (const candidate of candidates) {
    if (seenCommands.has(candidate.command.toLowerCase())) continue;
    if (!await shellCommandExists(candidate.command)) continue;

    seenCommands.add(candidate.command.toLowerCase());
    shells.push(candidate);
  }

  if (shells.length > 0) return shells;

  const fallback = process.platform === 'win32'
    ? { id: 'cmd', label: 'Command Prompt', command: process.env.ComSpec || 'cmd.exe' }
    : { id: 'sh', label: 'sh', command: '/bin/sh' };
  return [fallback];
}

function getWindowsShellCandidates(): CommandShell[] {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const comSpec = process.env.ComSpec || path.join(systemRoot, 'System32', 'cmd.exe');

  return [
    { id: 'powershell', label: 'Windows PowerShell', command: path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') },
    { id: 'pwsh', label: 'PowerShell 7+', command: path.join(programFiles, 'PowerShell', '7', 'pwsh.exe') },
    { id: 'pwsh-path', label: 'PowerShell từ PATH', command: 'pwsh.exe' },
    { id: 'cmd', label: 'Command Prompt', command: comSpec },
  ];
}

function getUnixShellCandidates(): CommandShell[] {
  const defaultShell = process.env.SHELL;
  const candidates: CommandShell[] = [];

  if (defaultShell) {
    candidates.push({ id: 'default', label: `${path.basename(defaultShell)} mặc định`, command: defaultShell });
  }

  candidates.push(
    { id: 'zsh', label: 'zsh', command: '/bin/zsh' },
    { id: 'bash', label: 'bash', command: '/bin/bash' },
    { id: 'sh', label: 'sh', command: '/bin/sh' },
    { id: 'fish', label: 'fish', command: '/opt/homebrew/bin/fish' },
    { id: 'fish-usr', label: 'fish', command: '/usr/local/bin/fish' },
  );

  return candidates;
}

async function shellCommandExists(command: string) {
  if (path.isAbsolute(command)) {
    return fileExists(command);
  }

  const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    if (await fileExists(path.join(entry, command))) {
      return true;
    }
  }

  return false;
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveCommandShell(shellId: string) {
  const shells = await getAvailableCommandShells();
  return shells.find((shell) => shell.id === shellId) ?? shells[0];
}

function normalizeTerminalDimension(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(Math.max(Math.floor(numericValue), min), max);
}

function killAllTerminals() {
  for (const terminal of activeTerminals.values()) {
    terminal.kill();
  }
  activeTerminals.clear();
}

function createTerminalProcess(
  shell: string,
  cwd: string,
  cols: number,
  rows: number,
  onData: (data: string) => void,
  onExit: (exitCode: number | undefined, signal: number | string | undefined) => void,
): TerminalProcess {
  try {
    const terminal = spawnPty(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: buildTerminalEnv(),
    });

    terminal.onData(onData);
    terminal.onExit(({ exitCode, signal }) => onExit(exitCode, signal));

    return {
      get cols() {
        return terminal.cols;
      },
      get rows() {
        return terminal.rows;
      },
      write: (data) => terminal.write(data),
      resize: (nextCols, nextRows) => terminal.resize(nextCols, nextRows),
      kill: () => terminal.kill(),
    };
  } catch (error) {
    const fallbackArgs = process.platform === 'win32' ? [] : ['-i'];
    const child = spawnChild(shell, fallbackArgs, {
      cwd,
      env: buildTerminalEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let currentCols = cols;
    let currentRows = rows;

    onData(`\r\n[terminal] PTY không khả dụng, đang dùng shell pipe fallback: ${error instanceof Error ? error.message : String(error)}\r\n`);
    child.stdout.on('data', (data: Buffer) => onData(data.toString('utf8')));
    child.stderr.on('data', (data: Buffer) => onData(data.toString('utf8')));
    child.on('exit', (exitCode, signal) => onExit(exitCode ?? undefined, signal ?? undefined));

    return {
      get cols() {
        return currentCols;
      },
      get rows() {
        return currentRows;
      },
      write: (data) => {
        child.stdin.write(data);
      },
      resize: (nextCols, nextRows) => {
        currentCols = nextCols;
        currentRows = nextRows;
      },
      kill: () => {
        child.kill();
      },
    };
  }
}

function cloneDefaultSettings(): StoredSettings {
  return {
    providers: DEFAULT_SETTINGS.providers.map((provider) => ({
      ...provider,
      models: provider.models.map((model) => ({ ...model })),
    })),
    activeProviderId: DEFAULT_SETTINGS.activeProviderId,
    activeModelId: DEFAULT_SETTINGS.activeModelId,
    permissionMode: DEFAULT_SETTINGS.permissionMode,
    workspacePath: DEFAULT_SETTINGS.workspacePath,
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
      workspacePath: typeof parsed.workspacePath === 'string' && parsed.workspacePath ? parsed.workspacePath : process.cwd(),
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

async function loadWorkspaceChatHistory(workspacePath: string) {
  try {
    const raw = await fs.readFile(getChatHistoryPath(workspacePath), 'utf8');
    const parsed = JSON.parse(raw) as ChatHistoryPayload;
    return {
      threads: Array.isArray(parsed.threads) ? parsed.threads : [],
      activeThreadId: typeof parsed.activeThreadId === 'string' ? parsed.activeThreadId : null,
    };
  } catch {
    return {
      threads: [],
      activeThreadId: null,
    };
  }
}

async function saveWorkspaceChatHistory(payload: ChatHistoryPayload) {
  const workspacePath = getString(payload.workspacePath) || await getWorkspaceRoot();
  const history = {
    threads: Array.isArray(payload.threads) ? payload.threads : [],
    activeThreadId: typeof payload.activeThreadId === 'string' ? payload.activeThreadId : null,
    savedAt: new Date().toISOString(),
    workspacePath,
  };

  await fs.mkdir(getChatHistoryDir(), { recursive: true });
  await fs.writeFile(getChatHistoryPath(workspacePath), JSON.stringify(history), 'utf8');
  return { ok: true };
}

function normalizeStoredProvider(provider: Partial<StoredProvider>): StoredProvider {
  return {
    id: typeof provider.id === 'string' && provider.id ? provider.id : randomUUID(),
    name: typeof provider.name === 'string' && provider.name ? provider.name : 'Unnamed',
    baseUrl: typeof provider.baseUrl === 'string' ? provider.baseUrl : '',
    models: normalizeModelList(provider.models),
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
      models: provider.models.map((model) => ({ ...model })),
      hasApiKey: Boolean(provider.encryptedApiKey || provider.plainApiKey),
    })),
    activeProviderId: settings.activeProviderId,
    activeModelId: settings.activeModelId,
    permissionMode: settings.permissionMode,
    workspacePath: settings.workspacePath,
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

function normalizeModelList(value: unknown): ModelMetadata[] {
  if (!Array.isArray(value)) return [];

  const models: ModelMetadata[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const model = readModelMetadata(item);
    if (!model || seen.has(model.id)) continue;
    seen.add(model.id);
    models.push(model);
  }
  return models;
}

function hasModel(provider: StoredProvider | null | undefined, modelId: string | null | undefined) {
  return Boolean(provider && modelId && provider.models.some((model) => model.id === modelId));
}

function firstModelId(provider: StoredProvider | null | undefined) {
  return provider?.models[0]?.id ?? null;
}

function getModelContextWindow(provider: StoredProvider, modelId: string | null | undefined) {
  if (!modelId) return undefined;
  return provider.models.find((model) => model.id === modelId)?.contextWindow;
}

async function fetchAvailableModels(baseUrl: string, apiKey: string): Promise<ModelMetadata[]> {
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
    return normalizeModelList(data.data);
  }

  if (isObject(data) && Array.isArray(data.models)) {
    return normalizeModelList(data.models);
  }

  if (Array.isArray(data)) {
    return normalizeModelList(data);
  }

  throw new Error('Định dạng danh sách model không hợp lệ từ server.');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readModelMetadata(value: unknown): ModelMetadata | null {
  if (typeof value === 'string') return { id: value };
  if (!isObject(value)) return null;

  const id = value.id;
  const name = value.name;
  const modelId = typeof id === 'string' && id ? id : typeof name === 'string' && name ? name : '';
  if (!modelId) return null;

  const contextWindow = readContextWindow(value);
  return contextWindow ? { id: modelId, contextWindow } : { id: modelId };
}

function readContextWindow(value: Record<string, unknown>): number | undefined {
  const fieldNames = [
    'contextWindow',
    'context_window',
    'contextLength',
    'context_length',
    'maxContextLength',
    'max_context_length',
    'maxContextWindow',
    'max_context_window',
    'maxModelLen',
    'max_model_len',
    'maxPositionEmbeddings',
    'max_position_embeddings',
    'n_ctx',
    'num_ctx',
    'context',
    'context_size',
    'token_limit',
  ];

  for (const fieldName of fieldNames) {
    const parsed = normalizeContextWindow(value[fieldName]);
    if (parsed) return parsed;
  }

  for (const fieldName of ['metadata', 'details', 'info', 'parameters', 'config', 'top_provider', 'context']) {
    const nested = value[fieldName];
    if (!isObject(nested)) continue;
    const parsed = readContextWindow(nested);
    if (parsed) return parsed;
  }

  return undefined;
}

function normalizeContextWindow(value: unknown): number | undefined {
  const numericValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.replace(/,/g, ''))
      : Number.NaN;
  if (!Number.isFinite(numericValue) || numericValue <= 0) return undefined;
  return Math.floor(numericValue);
}

function registerIpcHandlers() {
  ipcMain.handle('ping', () => 'pong');

  ipcMain.handle('settings:load', async () => {
    return toPublicSettings(await loadStoredSettings());
  });

  ipcMain.handle('workspace:get-current', async () => {
    return { path: await getWorkspaceRoot() };
  });

  ipcMain.handle('workspace:select-directory', async () => {
    const dialogOptions: OpenDialogOptions = {
      title: 'Chọn repository / workspace',
      properties: ['openDirectory'],
    };
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || !result.filePaths[0]) {
      return { path: await getWorkspaceRoot(), canceled: true };
    }

    const settings = await loadStoredSettings();
    settings.workspacePath = result.filePaths[0];
    await saveStoredSettings(settings);
    return { path: settings.workspacePath, canceled: false };
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
        models: normalizeModelList(provider.models),
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
      activeModelId: hasModel(activeProvider, legacyActiveModelId)
        ? legacyActiveModelId
        : firstModelId(activeProvider),
      permissionMode: normalizePermissionMode(rawPayload.permissionMode),
      workspacePath: process.cwd(),
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

    if (settings.activeProviderId === nextProvider.id && !hasModel(nextProvider, settings.activeModelId)) {
      settings.activeModelId = firstModelId(nextProvider);
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
      settings.activeModelId = firstModelId(nextProvider);
    }

    await saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:set-active-provider', async (_event, providerId: string) => {
    const settings = await loadStoredSettings();
    const provider = settings.providers.find((item) => item.id === providerId);
    if (!provider) throw new Error('Provider không tồn tại.');

    settings.activeProviderId = provider.id;
    if (!hasModel(provider, settings.activeModelId)) {
      settings.activeModelId = firstModelId(provider);
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
    const workspaceRoot = await getWorkspaceRoot();
    const targetPath = await resolveWorkspacePath(getString(payload.path));
    const content = getString(payload.content);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf8');
    return { ok: true, path: path.relative(workspaceRoot, targetPath) };
  });

  ipcMain.handle('chat:load-workspace', async (_event, rawWorkspacePath?: string) => {
    return loadWorkspaceChatHistory(getString(rawWorkspacePath) || await getWorkspaceRoot());
  });

  ipcMain.handle('chat:save-workspace', async (_event, rawPayload: ChatHistoryPayload) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    return saveWorkspaceChatHistory(payload);
  });

  ipcMain.handle('terminal:list-shells', async () => {
    return getAvailableCommandShells();
  });

  ipcMain.handle('terminal:create', async (event, rawPayload: TerminalCreatePayload) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const terminalId = randomUUID();
    const workspaceRoot = await getWorkspaceRoot();
    const shell = await resolveCommandShell(getString(payload.shellId));
    const cols = normalizeTerminalDimension(payload.cols, 100, 20, 400);
    const rows = normalizeTerminalDimension(payload.rows, 30, 5, 120);
    const terminal = createTerminalProcess(
      shell.command,
      workspaceRoot,
      cols,
      rows,
      (data) => {
        event.sender.send('terminal:data', { terminalId, data });
      },
      (exitCode, signal) => {
        activeTerminals.delete(terminalId);
        event.sender.send('terminal:exit', { terminalId, exitCode, signal });
      },
    );

    activeTerminals.set(terminalId, terminal);

    return {
      terminalId,
      shellId: shell.id,
      shell: shell.command,
      shellLabel: shell.label,
      cwd: workspaceRoot,
    };
  });

  ipcMain.on('terminal:write', (_event, rawPayload: TerminalWritePayload) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const terminalId = getString(payload.terminalId);
    const data = getString(payload.data);
    activeTerminals.get(terminalId)?.write(data);
  });

  ipcMain.on('terminal:resize', (_event, rawPayload: TerminalResizePayload) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const terminalId = getString(payload.terminalId);
    const terminal = activeTerminals.get(terminalId);
    if (!terminal) return;

    terminal.resize(
      normalizeTerminalDimension(payload.cols, terminal.cols, 20, 400),
      normalizeTerminalDimension(payload.rows, terminal.rows, 5, 120),
    );
  });

  ipcMain.on('terminal:kill', (_event, rawPayload: TerminalTargetPayload) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const terminalId = getString(payload.terminalId);
    activeTerminals.get(terminalId)?.kill();
    activeTerminals.delete(terminalId);
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
        contextWindow: getModelContextWindow(activeProvider, settings.activeModelId),
        permissionMode: settings.permissionMode,
      }, settings.workspacePath || process.cwd(), controller.signal);
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
  killAllTerminals();
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
