import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { parse } from 'yaml';
import type { AgentProfileDescriptor, AgentProfileOrigin } from '../../domain/entities/agentProfile.js';
import type { IAgentProfileCatalog } from '../../domain/ports/IAgentProfileCatalog.js';
import { isInsidePath } from '../security/resolveSafePath.js';

const MAX_PROFILE_FILE_BYTES = 128_000;
const MAX_PROFILES_PER_ROOT = 100;
const ALLOWED_PROFILE_TOOLS = new Set(['list_files', 'read_file', 'glob', 'grep', 'load_skill']);

export class FileSystemAgentProfileCatalog implements IAgentProfileCatalog {
  private readonly configuredRoots?: Array<{ root: string; origin: AgentProfileOrigin }>;

  constructor(configuredRoots?: Array<{ root: string; origin: AgentProfileOrigin }>) {
    this.configuredRoots = configuredRoots;
  }

  async discover(workspaceRoot: string) {
    const roots = this.configuredRoots ?? defaultRoots(workspaceRoot);
    const discovered = await Promise.all(roots.map(({ root, origin }) => this.scanRoot(root, origin)));
    const unique = new Map<string, AgentProfileDescriptor>();
    for (const profile of discovered.flat()) unique.set(profile.id, profile);
    return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  async readInstructions(profile: AgentProfileDescriptor) {
    const parsed = await readProfileFile(profile.filePath);
    if (profileContentHash(parsed) !== profile.contentHash) throw new Error('Agent profile changed after trust was granted. Review and trust it again.');
    return parsed.body.trim();
  }

  private async scanRoot(root: string, origin: AgentProfileOrigin): Promise<AgentProfileDescriptor[]> {
    try {
      const realRoot = await fs.realpath(root);
      const entries = (await fs.readdir(realRoot, { withFileTypes: true }))
        .filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith('.md'))
        .slice(0, MAX_PROFILES_PER_ROOT);
      const profiles: Array<AgentProfileDescriptor | null> = await Promise.all(entries.map(async (entry) => {
        try {
          const filePath = await fs.realpath(path.join(realRoot, entry.name));
          if (!isInsidePath(filePath, realRoot)) return null;
          const parsed = await readProfileFile(filePath);
          const contentHash = profileContentHash(parsed);
          const expectedName = entry.name.slice(0, -3);
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsed.name) || parsed.name !== expectedName) return null;
          return {
            id: createHash('sha256').update(`${filePath}\0${contentHash}`).digest('hex').slice(0, 20),
            name: parsed.name,
            description: parsed.description,
            origin,
            filePath,
            contentHash,
            ...(parsed.allowedTools ? { allowedTools: parsed.allowedTools } : {}),
          } satisfies AgentProfileDescriptor;
        } catch {
          return null;
        }
      }));
      return profiles.filter((profile): profile is AgentProfileDescriptor => profile !== null);
    } catch {
      return [];
    }
  }
}

function defaultRoots(workspaceRoot: string): Array<{ root: string; origin: AgentProfileOrigin }> {
  return [
    { root: path.join(app.getPath('userData'), 'agents'), origin: 'user' },
    { root: path.join(os.homedir(), '.agents', 'agents'), origin: 'user' },
    { root: path.join(workspaceRoot, '.agents', 'agents'), origin: 'workspace' },
    { root: path.join(workspaceRoot, '.agent', 'agents'), origin: 'workspace' },
    { root: path.join(workspaceRoot, '.claude', 'agents'), origin: 'workspace' },
  ];
}

async function readProfileFile(filePath: string) {
  const handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_PROFILE_FILE_BYTES) throw new Error('Agent profile is missing or too large.');
    const content = await handle.readFile({ encoding: 'utf8' });
    if (Buffer.byteLength(content, 'utf8') > MAX_PROFILE_FILE_BYTES) throw new Error('Agent profile is too large.');
    return parseProfileFile(content);
  } finally {
    await handle.close();
  }
}

function parseProfileFile(content: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content);
  if (!match) throw new Error('Agent profile must contain YAML frontmatter.');
  const raw = parse(match[1]) as unknown;
  if (!isObject(raw) || typeof raw.name !== 'string' || typeof raw.description !== 'string' || !match[2].trim()) {
    throw new Error('Agent profile requires name, description, and instructions.');
  }
  const name = raw.name.trim();
  const description = raw.description.trim().slice(0, 1_024);
  if (!name || !description) throw new Error('Agent profile name and description cannot be empty.');
  const allowedTools = readAllowedTools(raw.tools);
  return { name, description, allowedTools, body: match[2] };
}

function readAllowedTools(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,]+/) : [];
  if (!values.length || values.some((tool) => typeof tool !== 'string' || !ALLOWED_PROFILE_TOOLS.has(tool))) {
    throw new Error('Agent profile tools must be a non-empty subset of read-only local tools.');
  }
  return [...new Set(values as string[])];
}

function profileContentHash(profile: { name: string; description: string; allowedTools?: string[]; body: string }) {
  return createHash('sha256').update(JSON.stringify(profile)).digest('hex');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
