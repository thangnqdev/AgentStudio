import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { LspServerConfiguration } from '../../domain/entities/lspServer.js';
import { resolveSafeWorkspacePath } from '../security/resolveSafePath.js';

const DEFAULT_LSP_PATH = '.lsp.json';
const MAX_LSP_SOURCE_BYTES = 128 * 1024;
const MAX_LSP_SOURCES = 20;

export type PluginLspLoadResult = { configurations: LspServerConfiguration[]; hashContent: string };

export async function loadPluginLspConfigurations(
  pluginRoot: string,
  pluginName: string,
  configured: unknown,
  pluginDataRoot: string,
): Promise<PluginLspLoadResult> {
  const sources: Array<{ label: string; payload: unknown; content: string }> = [];
  const defaultSource = await optionalJsonSource(pluginRoot, DEFAULT_LSP_PATH);
  if (defaultSource) sources.push(defaultSource);
  const values = configured === undefined ? [] : Array.isArray(configured) ? configured : [configured];
  if (values.length > MAX_LSP_SOURCES) throw new Error(`Plugin LSP source limit exceeded (${MAX_LSP_SOURCES}).`);
  for (const [index, value] of values.entries()) {
    if (typeof value === 'string') {
      if (value === DEFAULT_LSP_PATH && defaultSource) continue;
      sources.push(await readJsonSource(await resolveSafeWorkspacePath(value, pluginRoot), value));
    } else if (isObject(value)) {
      sources.push({ label: `inline-${index + 1}`, payload: value, content: JSON.stringify(value) });
    } else {
      throw new Error('Plugin lspServers entries must be relative JSON paths or configuration objects.');
    }
  }
  const substitutions = {
    '${CLAUDE_PLUGIN_ROOT}': pluginRoot,
    '${CLAUDE_PLUGIN_DATA}': path.join(pluginDataRoot, pluginName),
  };
  const configurations = sources.flatMap((source) => normalizeSource(source.payload, pluginName, substitutions));
  const names = new Set<string>();
  for (const config of configurations) {
    if (names.has(config.name)) throw new Error(`Duplicate plugin LSP server: ${config.name}.`);
    names.add(config.name);
  }
  return {
    configurations,
    hashContent: sources.map((source) => `\0${source.label}\0${source.content}`).join(''),
  };
}

function normalizeSource(payload: unknown, pluginName: string, substitutions: Record<string, string>) {
  const entries = Array.isArray(payload)
    ? payload.map((value, index) => [isObject(value) && typeof value.name === 'string' ? value.name : `server-${index + 1}`, value] as const)
    : isObject(payload) && typeof payload.command === 'string'
      ? [[typeof payload.name === 'string' ? payload.name : 'default', payload] as const]
      : isObject(payload) ? Object.entries(payload) : [];
  if (!entries.length) throw new Error('Plugin LSP configuration must contain at least one server.');
  return entries.map(([name, raw]) => normalizeServer(pluginName, name, raw, substitutions));
}

function normalizeServer(pluginName: string, rawName: string, raw: unknown, substitutions: Record<string, string>): LspServerConfiguration {
  if (!isObject(raw)) throw new Error(`LSP server '${rawName}' must be an object.`);
  const name = rawName.trim();
  const command = normalizeCommand(
    expand(requiredString(raw.command, `LSP server '${name}' requires command.`), substitutions),
    substitutions['${CLAUDE_PLUGIN_ROOT}']!,
  );
  if (!name || name.length > 100 || name.includes(':')) throw new Error('LSP server names must be non-empty and cannot contain colons.');
  if (raw.transport !== undefined && raw.transport !== 'stdio') throw new Error(`LSP server '${name}' only supports stdio transport.`);
  const args = optionalStringArray(raw.args, `LSP server '${name}' args must be strings.`).map((value) => expand(value, substitutions));
  const extensionToLanguage = stringRecord(raw.extensionToLanguage, `LSP server '${name}' requires extensionToLanguage.`);
  if (!Object.keys(extensionToLanguage).length || Object.entries(extensionToLanguage).some(([extension, language]) => (
    !extension.startsWith('.') || extension.length > 32 || !language.trim() || language.length > 100
  ))) throw new Error(`LSP server '${name}' has an invalid extensionToLanguage mapping.`);
  const env = raw.env === undefined ? undefined : stringRecord(raw.env, `LSP server '${name}' env must contain strings.`);
  if (env && Object.keys(env).some((key) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))) throw new Error(`LSP server '${name}' has an invalid environment key.`);
  const workspaceFolder = typeof raw.workspaceFolder === 'string' ? expand(raw.workspaceFolder, substitutions) : undefined;
  const startupTimeoutMs = optionalInteger(raw.startupTimeout ?? raw.startupTimeoutMs, 100, 120_000, 'startup timeout');
  const maxRestarts = optionalInteger(raw.maxRestarts, 0, 10, 'maxRestarts');
  return {
    name: `plugin:${pluginName}:${name}`,
    command,
    ...(args.length ? { args } : {}), extensionToLanguage,
    ...(env ? { env: Object.fromEntries(Object.entries(env).map(([key, value]) => [key, expand(value, substitutions)])) } : {}),
    ...(raw.initializationOptions !== undefined ? { initializationOptions: structuredClone(raw.initializationOptions) } : {}),
    ...(raw.settings !== undefined ? { settings: structuredClone(raw.settings) } : {}),
    ...(workspaceFolder ? { workspaceFolder } : {}),
    ...(startupTimeoutMs !== undefined ? { startupTimeoutMs } : {}),
    ...(maxRestarts !== undefined ? { maxRestarts } : {}),
  };
}

async function optionalJsonSource(root: string, relativePath: string) {
  try { return await readJsonSource(await resolveSafeWorkspacePath(relativePath, root), relativePath); }
  catch (error) { if (isMissing(error)) return undefined; throw error; }
}

async function readJsonSource(target: string, label: string) {
  const handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_LSP_SOURCE_BYTES) throw new Error('Plugin LSP JSON is missing or too large.');
    const content = await handle.readFile('utf8');
    return { label, content, payload: JSON.parse(content) as unknown };
  } finally { await handle.close(); }
}

function requiredString(value: unknown, message: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4_096 || value.includes('\0')) throw new Error(message);
  return value.trim();
}
function optionalStringArray(value: unknown, message: string) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== 'string' || item.length > 4_096 || item.includes('\0'))) throw new Error(message);
  return value as string[];
}
function stringRecord(value: unknown, message: string) {
  if (!isObject(value) || Object.keys(value).length > 100 || Object.values(value).some((item) => typeof item !== 'string')) throw new Error(message);
  return value as Record<string, string>;
}
function optionalInteger(value: unknown, minimum: number, maximum: number, name: string) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new Error(`LSP ${name} is invalid.`);
  return value as number;
}
function expand(value: string, substitutions: Record<string, string>) {
  return Object.entries(substitutions).reduce((result, [token, replacement]) => result.replaceAll(token, replacement), value);
}
function normalizeCommand(command: string, pluginRoot: string) {
  if (path.isAbsolute(command) || !command.includes('/')) return command;
  const resolved = path.resolve(pluginRoot, command);
  const relative = path.relative(pluginRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Plugin LSP command escapes the plugin root.');
  return resolved;
}
function isMissing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
