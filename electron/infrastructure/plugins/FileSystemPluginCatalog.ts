import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { normalizeLifecycleHookDocument, type LifecycleHookDefinition } from '../../domain/entities/lifecycleHook.js';
import type { PluginComponent, PluginDescriptor, PluginOrigin } from '../../domain/entities/plugin.js';
import type { IPluginCatalog } from '../../domain/ports/IPluginCatalog.js';
import { isInsidePath, resolveSafeWorkspacePath } from '../security/resolveSafePath.js';
import type { LspServerConfiguration } from '../../domain/entities/lspServer.js';
import { loadPluginLspConfigurations } from './pluginLspConfiguration.js';

const MAX_PLUGIN_MANIFEST_BYTES = 128 * 1024;
const MAX_PLUGINS_PER_ROOT = 50;
const MAX_PLUGIN_HOOK_SOURCES = 20;
const MANIFEST_PATH = '.claude-plugin/plugin.json';
const DEFAULT_HOOKS_PATH = 'hooks/hooks.json';

type PluginRoot = { root: string; origin: PluginOrigin };
type HookSource = { path?: string; payload: unknown; content: string };
type LoadedCandidate = { descriptor: PluginDescriptor; hooks: LifecycleHookDefinition[]; lspServers: LspServerConfiguration[] };

export class FileSystemPluginCatalog implements IPluginCatalog {
  private readonly configuredRoots?: PluginRoot[];
  private readonly configuredPluginDataRoot?: string;

  constructor(configuredRoots?: PluginRoot[], configuredPluginDataRoot?: string) {
    this.configuredRoots = configuredRoots;
    this.configuredPluginDataRoot = configuredPluginDataRoot;
  }

  async discover(workspaceRoot: string) {
    const roots = this.configuredRoots ?? [
      { root: path.join(app.getPath('userData'), 'plugins'), origin: 'user' },
      { root: path.join(workspaceRoot, '.agentstudio', 'plugins'), origin: 'workspace' },
    ] satisfies PluginRoot[];
    const candidates = await Promise.all(roots.map(({ root, origin }) => this.scanRoot(root, origin)));
    return candidates.flat().sort((left, right) => left.name.localeCompare(right.name));
  }

  async readHooks(plugin: PluginDescriptor) {
    const loaded = await this.loadCandidate(plugin.rootPath, plugin.origin);
    if (loaded.descriptor.contentHash !== plugin.contentHash || loaded.descriptor.id !== plugin.id) {
      throw new Error('Plugin content changed after trust was granted. Review and trust it again.');
    }
    return loaded.hooks;
  }

  async readLspServers(plugin: PluginDescriptor) {
    const loaded = await this.loadCandidate(plugin.rootPath, plugin.origin);
    if (loaded.descriptor.contentHash !== plugin.contentHash || loaded.descriptor.id !== plugin.id) {
      throw new Error('Plugin content changed after trust was granted. Review and trust it again.');
    }
    return loaded.lspServers;
  }

  private async scanRoot(root: string, origin: PluginOrigin) {
    try {
      const realRoot = await fs.realpath(root);
      const entries = (await fs.readdir(realRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .slice(0, MAX_PLUGINS_PER_ROOT);
      const loaded = await Promise.all(entries.map(async (entry) => {
        try {
          const pluginRoot = await fs.realpath(path.join(realRoot, entry.name));
          if (!isInsidePath(pluginRoot, realRoot)) return null;
          return (await this.loadCandidate(pluginRoot, origin)).descriptor;
        } catch {
          return null;
        }
      }));
      return loaded.filter((plugin): plugin is PluginDescriptor => plugin !== null);
    } catch {
      return [];
    }
  }

  private async loadCandidate(pluginRoot: string, origin: PluginOrigin): Promise<LoadedCandidate> {
    const manifestFile = await resolveSafeWorkspacePath(MANIFEST_PATH, pluginRoot);
    const manifestDocument = await readJsonFile(manifestFile);
    const manifest = readManifest(manifestDocument.payload);
    const hookSources = await readHookSources(pluginRoot, manifest.hooks);
    const hooks = hookSources.flatMap((source) => normalizeHookPayload(source.payload));
    assertUniqueHookIds(hooks);
    const lsp = await loadPluginLspConfigurations(
      pluginRoot, manifest.name, manifest.raw.lspServers, this.pluginDataRoot(pluginRoot),
    );
    const components = await detectComponents(pluginRoot, manifest.raw, hookSources.length > 0, lsp.configurations.length > 0);
    const contentHash = createHash('sha256')
      .update(manifestDocument.content)
      .update(hookSources.map((source) => `\0${source.path ?? 'inline'}\0${source.content}`).join(''))
      .update(lsp.hashContent)
      .digest('hex');
    const descriptor: PluginDescriptor = {
      id: createHash('sha256').update(`${pluginRoot}\0${contentHash}`).digest('hex').slice(0, 20),
      name: manifest.name,
      ...(manifest.version ? { version: manifest.version } : {}),
      description: manifest.description,
      origin,
      rootPath: pluginRoot,
      manifestPath: manifestFile,
      contentHash,
      components,
      unsupportedComponents: components.filter((component) => component !== 'hooks' && component !== 'lspServers'),
    };
    return { descriptor, hooks, lspServers: lsp.configurations };
  }

  private pluginDataRoot(pluginRoot: string) {
    if (this.configuredPluginDataRoot) return this.configuredPluginDataRoot;
    if (this.configuredRoots) return path.join(path.dirname(pluginRoot), '.agentstudio-plugin-data');
    return path.join(app.getPath('userData'), 'plugin-data');
  }
}

async function readHookSources(pluginRoot: string, configured: unknown): Promise<HookSource[]> {
  const sources: HookSource[] = [];
  const defaultPath = await optionalSafePath(DEFAULT_HOOKS_PATH, pluginRoot);
  if (defaultPath) sources.push(await readHookFile(defaultPath, DEFAULT_HOOKS_PATH));
  const values = configured === undefined ? [] : Array.isArray(configured) ? configured : [configured];
  if (values.length > MAX_PLUGIN_HOOK_SOURCES) throw new Error(`Plugin hook source limit exceeded (${MAX_PLUGIN_HOOK_SOURCES}).`);
  for (const value of values) {
    if (typeof value === 'string') {
      if (value === DEFAULT_HOOKS_PATH && defaultPath) continue;
      const target = await resolveSafeWorkspacePath(value, pluginRoot);
      sources.push(await readHookFile(target, value));
    } else if (isObject(value)) {
      sources.push({ payload: value, content: JSON.stringify(value) });
    } else {
      throw new Error('Plugin hooks must be relative JSON paths or declarative hook objects.');
    }
  }
  return sources;
}

async function readHookFile(target: string, relativePath: string) {
  const document = await readJsonFile(target);
  return { path: relativePath, ...document } satisfies HookSource;
}

function normalizeHookPayload(payload: unknown) {
  if (!isObject(payload)) throw new Error('Plugin hook payload must be an object.');
  if (payload.version === 1) return normalizeLifecycleHookDocument(payload);
  if (isObject(payload.hooks)) return normalizeLifecycleHookDocument({ version: 1, hooks: payload.hooks });
  return normalizeLifecycleHookDocument({ version: 1, hooks: payload });
}

async function detectComponents(pluginRoot: string, manifest: Record<string, unknown>, hasHooks: boolean, hasLspServers: boolean) {
  const components: PluginComponent[] = [];
  if (hasHooks) components.push('hooks');
  if (manifest.skills !== undefined || await hasDirectory(pluginRoot, 'skills')) components.push('skills');
  if (manifest.agents !== undefined || await hasDirectory(pluginRoot, 'agents')) components.push('agents');
  if (manifest.commands !== undefined || await hasDirectory(pluginRoot, 'commands')) components.push('commands');
  if (manifest.mcpServers !== undefined) components.push('mcpServers');
  if (hasLspServers) components.push('lspServers');
  return components;
}

function readManifest(raw: unknown) {
  if (!isObject(raw)) throw new Error('Plugin manifest must be an object.');
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error('Plugin name must use kebab-case.');
  const version = typeof raw.version === 'string' && raw.version.trim() ? raw.version.trim().slice(0, 100) : undefined;
  const description = typeof raw.description === 'string' && raw.description.trim()
    ? raw.description.trim().slice(0, 1_024)
    : 'Local declarative plugin';
  return { name, version, description, hooks: raw.hooks, raw };
}

async function readJsonFile(target: string) {
  const handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_PLUGIN_MANIFEST_BYTES) throw new Error('Plugin JSON file is missing or too large.');
    const content = await handle.readFile({ encoding: 'utf8' });
    if (Buffer.byteLength(content, 'utf8') > MAX_PLUGIN_MANIFEST_BYTES) throw new Error('Plugin JSON file is too large.');
    return { content, payload: JSON.parse(content) as unknown };
  } finally {
    await handle.close();
  }
}

async function optionalSafePath(candidate: string, root: string) {
  try {
    return await resolveSafeWorkspacePath(candidate, root);
  } catch (error) {
    if (isMissingPath(error)) return undefined;
    throw error;
  }
}

async function hasDirectory(root: string, candidate: string) {
  const target = await optionalSafePath(candidate, root);
  return target ? (await fs.stat(target)).isDirectory() : false;
}

function assertUniqueHookIds(hooks: readonly LifecycleHookDefinition[]) {
  const ids = new Set<string>();
  for (const hook of hooks) {
    if (ids.has(hook.id)) throw new Error(`Duplicate plugin hook id: ${hook.id}.`);
    ids.add(hook.id);
  }
}

function isMissingPath(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
