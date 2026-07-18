import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MAX_LSP_FILE_BYTES, type LspGatewayResult, type LspToolInput } from '../../domain/entities/lsp.js';
import type { LspServerConfiguration } from '../../domain/entities/lspServer.js';
import type { ILanguageServerGateway } from '../../domain/ports/ILanguageServerGateway.js';
import type { ILspDiagnosticSink } from '../../domain/ports/ILspDiagnosticSink.js';
import { isInsidePath, resolveSafeWorkspacePath } from '../security/resolveSafePath.js';
import { createStdioLspClient, LspResponseError, type LspProcessClient } from './StdioLspClient.js';
import { normalizePublishedDiagnostics } from './lspDiagnosticNormalization.js';
import { normalizeLspResponse } from './lspResponseNormalization.js';

const DEFAULT_STARTUP_TIMEOUT_MS = 15_000;
const CONTENT_MODIFIED_ERROR = -32801;
const TRANSIENT_RETRY_DELAYS_MS = [500, 1_000, 2_000];

type ServerState = {
  config: LspServerConfiguration;
  client: LspProcessClient;
  startPromise?: Promise<void>;
  initialized: boolean;
  starts: number;
  openedFiles: Map<string, number>;
};

type ClientFactory = (serverName: string) => LspProcessClient;

export class WorkspaceLspServerManager implements ILanguageServerGateway {
  private readonly workspaceRoot: string;
  private readonly configurations: LspServerConfiguration[];
  private readonly states = new Map<string, ServerState>();
  private readonly clientFactory: ClientFactory;
  private readonly diagnosticSink?: ILspDiagnosticSink;

  constructor(
    workspaceRoot: string,
    configurations: LspServerConfiguration[],
    clientFactory: ClientFactory = createStdioLspClient,
    diagnosticSink?: ILspDiagnosticSink,
  ) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.configurations = configurations.map(validateConfiguration);
    if (new Set(this.configurations.map((config) => config.name)).size !== this.configurations.length) {
      throw new Error('LSP server names must be unique within a workspace.');
    }
    this.clientFactory = clientFactory;
    this.diagnosticSink = diagnosticSink;
  }

  async isAvailable(workspaceRoot: string) {
    return this.sameWorkspace(workspaceRoot) && this.configurations.length > 0;
  }

  async execute(input: LspToolInput, workspaceRoot: string, signal?: AbortSignal): Promise<LspGatewayResult | undefined> {
    if (!this.sameWorkspace(workspaceRoot)) throw new Error('LSP manager is scoped to a different workspace.');
    const absolutePath = await resolveLspPath(input.filePath, this.workspaceRoot);
    const config = this.configurationFor(absolutePath);
    if (!config) return undefined;
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) throw new Error(`Path is not a file: ${input.filePath}`);
    if (stat.size > MAX_LSP_FILE_BYTES) {
      throw new Error(`File too large for LSP analysis (${Math.ceil(stat.size / 1_000_000)}MB exceeds 10MB limit)`);
    }
    const state = await this.ensureStarted(config);
    await this.ensureOpen(state, absolutePath);
    const raw = await this.performOperation(state, input, absolutePath, signal);
    return normalizeLspResponse(input.operation, raw, this.workspaceRoot);
  }

  async shutdown() {
    const states = [...this.states.values()];
    this.states.clear();
    await Promise.allSettled(states.map((state) => state.client.stop()));
  }

  async fileChanged(filePath: string) {
    const absolutePath = await resolveLspPath(filePath, this.workspaceRoot);
    this.diagnosticSink?.clearFile(pathToFileURL(absolutePath).href);
    const config = this.configurationFor(absolutePath);
    const state = config ? this.states.get(config.name) : undefined;
    const version = state?.openedFiles.get(absolutePath);
    if (!state?.initialized || version === undefined || !state.client.started) return;
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile() || stat.size > MAX_LSP_FILE_BYTES) return;
    const nextVersion = version + 1;
    const uri = pathToFileURL(absolutePath).href;
    await state.client.sendNotification('textDocument/didChange', {
      textDocument: { uri, version: nextVersion },
      contentChanges: [{ text: await fs.readFile(absolutePath, 'utf8') }],
    });
    await state.client.sendNotification('textDocument/didSave', { textDocument: { uri } });
    state.openedFiles.set(absolutePath, nextVersion);
  }

  private sameWorkspace(candidate: string) {
    return path.resolve(candidate) === this.workspaceRoot;
  }

  private configurationFor(filePath: string) {
    const extension = path.extname(filePath).toLowerCase();
    return this.configurations.find((config) => Object.keys(config.extensionToLanguage).some((item) => item.toLowerCase() === extension));
  }

  private stateFor(config: LspServerConfiguration) {
    let state = this.states.get(config.name);
    if (!state) {
      const client = this.clientFactory(config.name);
      if (this.diagnosticSink) {
        client.onNotification('textDocument/publishDiagnostics', (params) => {
          try {
            const files = normalizePublishedDiagnostics(params, this.workspaceRoot);
            if (files.length > 0) this.diagnosticSink?.publish(config.name, files);
          } catch { /* Passive feedback failures must not break active LSP requests. */ }
        });
      }
      client.onRequest('workspace/configuration', (params) => {
        const items = isObject(params) && Array.isArray(params.items) ? params.items : [];
        return items.map(() => null);
      });
      state = { config, client, initialized: false, starts: 0, openedFiles: new Map() };
      this.states.set(config.name, state);
    }
    return state;
  }

  private async ensureStarted(config: LspServerConfiguration) {
    const state = this.stateFor(config);
    if (state.client.started && state.initialized) return state;
    if (state.startPromise) { await state.startPromise; return state; }
    const maxStarts = (config.maxRestarts ?? 3) + 1;
    if (state.starts >= maxStarts) throw new Error(`LSP server '${config.name}' exceeded max start attempts (${maxStarts}).`);
    state.starts += 1;
    state.openedFiles.clear();
    state.initialized = false;
    state.startPromise = this.start(state).finally(() => { state.startPromise = undefined; });
    await state.startPromise;
    return state;
  }

  private async start(state: ServerState) {
    const workspaceFolder = state.config.workspaceFolder
      ? await resolveSafeWorkspacePath(state.config.workspaceFolder, this.workspaceRoot)
      : this.workspaceRoot;
    await state.client.start(state.config.command, state.config.args || [], { cwd: workspaceFolder, env: state.config.env });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), state.config.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS);
    try {
      await state.client.sendRequest('initialize', initializationParams(workspaceFolder, state.config), controller.signal);
      await state.client.sendNotification('initialized', {});
      if (state.config.settings !== undefined) {
        await state.client.sendNotification('workspace/didChangeConfiguration', { settings: state.config.settings });
      }
      state.initialized = true;
    } catch (error) {
      await state.client.stop().catch(() => undefined);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async ensureOpen(state: ServerState, filePath: string) {
    if (state.openedFiles.has(filePath)) return;
    const extension = path.extname(filePath).toLowerCase();
    await state.client.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: pathToFileURL(filePath).href,
        languageId: state.config.extensionToLanguage[extension] || 'plaintext',
        version: 1,
        text: await fs.readFile(filePath, 'utf8'),
      },
    });
    state.openedFiles.set(filePath, 1);
  }

  private async performOperation(state: ServerState, input: LspToolInput, filePath: string, signal?: AbortSignal) {
    const { method, params } = methodAndParams(input, filePath);
    let raw = await requestWithTransientRetry(state.client, method, params, signal);
    if (input.operation !== 'incomingCalls' && input.operation !== 'outgoingCalls') return raw;
    const items = Array.isArray(raw) ? raw : [];
    if (!items[0]) return [];
    const callMethod = input.operation === 'incomingCalls' ? 'callHierarchy/incomingCalls' : 'callHierarchy/outgoingCalls';
    raw = await requestWithTransientRetry(state.client, callMethod, { item: items[0] }, signal);
    return raw;
  }
}

async function resolveLspPath(inputPath: string, workspaceRoot: string) {
  if (inputPath.startsWith('\\\\') || inputPath.startsWith('//')) throw new Error('UNC paths are not allowed for LSP operations.');
  if (path.isAbsolute(inputPath)) {
    const [realRoot, realTarget] = await Promise.all([fs.realpath(workspaceRoot), fs.realpath(inputPath)]);
    if (!isInsidePath(realTarget, realRoot)) throw new Error(`Path escapes workspace: ${inputPath}`);
    return realTarget;
  }
  return resolveSafeWorkspacePath(inputPath, workspaceRoot);
}

function methodAndParams(input: LspToolInput, filePath: string) {
  const textDocument = { uri: pathToFileURL(filePath).href };
  const position = { line: input.line - 1, character: input.character - 1 };
  if (input.operation === 'goToDefinition') return { method: 'textDocument/definition', params: { textDocument, position } };
  if (input.operation === 'findReferences') return { method: 'textDocument/references', params: { textDocument, position, context: { includeDeclaration: true } } };
  if (input.operation === 'hover') return { method: 'textDocument/hover', params: { textDocument, position } };
  if (input.operation === 'documentSymbol') return { method: 'textDocument/documentSymbol', params: { textDocument } };
  if (input.operation === 'workspaceSymbol') return { method: 'workspace/symbol', params: { query: '' } };
  if (input.operation === 'goToImplementation') return { method: 'textDocument/implementation', params: { textDocument, position } };
  return { method: 'textDocument/prepareCallHierarchy', params: { textDocument, position } };
}

async function requestWithTransientRetry(client: LspProcessClient, method: string, params: unknown, signal?: AbortSignal) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await client.sendRequest(method, params, signal); }
    catch (error) {
      if (!(error instanceof LspResponseError) || error.code !== CONTENT_MODIFIED_ERROR || attempt >= TRANSIENT_RETRY_DELAYS_MS.length) throw error;
      await delay(TRANSIENT_RETRY_DELAYS_MS[attempt]!, signal);
    }
  }
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('LSP operation cancelled.')); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('LSP operation cancelled.')); }, { once: true });
  });
}

function initializationParams(workspaceFolder: string, config: LspServerConfiguration) {
  const workspaceUri = pathToFileURL(workspaceFolder).href;
  return {
    processId: process.pid,
    initializationOptions: config.initializationOptions ?? {},
    rootPath: workspaceFolder,
    rootUri: workspaceUri,
    workspaceFolders: [{ uri: workspaceUri, name: path.basename(workspaceFolder) }],
    capabilities: {
      workspace: { configuration: false, workspaceFolders: false },
      textDocument: {
        synchronization: { dynamicRegistration: false, willSave: false, willSaveWaitUntil: false, didSave: true },
        publishDiagnostics: { relatedInformation: true, tagSupport: { valueSet: [1, 2] } },
        hover: { dynamicRegistration: false, contentFormat: ['markdown', 'plaintext'] },
        definition: { dynamicRegistration: false, linkSupport: true },
        references: { dynamicRegistration: false },
        documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
        callHierarchy: { dynamicRegistration: false },
      },
      general: { positionEncodings: ['utf-16'] },
    },
  };
}

function validateConfiguration(config: LspServerConfiguration) {
  if (!config.name.trim() || !config.command.trim()) throw new Error('LSP server name and command are required.');
  if (config.args?.some((argument) => !argument)) throw new Error(`LSP server '${config.name}' contains an empty argument.`);
  const entries = Object.entries(config.extensionToLanguage);
  if (!entries.length || entries.some(([extension, language]) => !extension.startsWith('.') || extension.length < 2 || !language)) {
    throw new Error(`LSP server '${config.name}' requires extensionToLanguage entries such as ".ts": "typescript".`);
  }
  return {
    ...config,
    extensionToLanguage: Object.fromEntries(entries.map(([extension, language]) => [extension.toLowerCase(), language])),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
