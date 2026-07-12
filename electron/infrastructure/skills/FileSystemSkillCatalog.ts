import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { parse } from 'yaml';
import type { SkillDescriptor, SkillOrigin } from '../../domain/entities/skill.js';
import type { ISkillCatalog } from '../../domain/ports/ISkillCatalog.js';
import { isInsidePath } from '../security/resolveSafePath.js';

const MAX_SKILL_FILE_BYTES = 512_000;

export class FileSystemSkillCatalog implements ISkillCatalog {
  async discover(workspaceRoot: string) {
    const roots: Array<{ root: string; origin: SkillOrigin }> = [
      { root: path.join(app.getPath('userData'), 'skills'), origin: 'user' },
      { root: path.join(os.homedir(), '.agents', 'skills'), origin: 'user' },
      { root: path.join(workspaceRoot, '.agents', 'skills'), origin: 'workspace' },
      { root: path.join(workspaceRoot, '.agent', 'skills'), origin: 'workspace' },
    ];
    const discovered = await Promise.all(roots.map(({ root, origin }) => this.scanRoot(root, origin)));
    const unique = new Map<string, SkillDescriptor>();
    for (const skill of discovered.flat()) unique.set(skill.id, skill);
    return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  async readInstructions(skill: SkillDescriptor) {
    const content = await this.readSkillFile(skill.rootPath);
    return parseSkillFile(content).body.trim();
  }

  private async scanRoot(root: string, origin: SkillOrigin): Promise<SkillDescriptor[]> {
    try {
      const realRoot = await fs.realpath(root);
      const entries = await fs.readdir(realRoot, { withFileTypes: true });
      const skills = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
        try {
          const skillRoot = await fs.realpath(path.join(realRoot, entry.name));
          if (!isInsidePath(skillRoot, realRoot)) return null;
          const parsed = parseSkillFile(await this.readSkillFile(skillRoot));
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsed.metadata.name) || parsed.metadata.name !== entry.name) return null;
          return {
            id: createHash('sha256').update(skillRoot).digest('hex').slice(0, 20),
            name: parsed.metadata.name,
            description: parsed.metadata.description,
            origin,
            rootPath: skillRoot,
            compatibility: parsed.metadata.compatibility,
            allowedTools: parsed.metadata.allowedTools,
          } satisfies SkillDescriptor;
        } catch {
          return null;
        }
      }));
      return skills.filter((skill) => skill !== null).map((skill) => skill as SkillDescriptor);
    } catch {
      return [];
    }
  }

  private async readSkillFile(skillRoot: string) {
    const skillFile = await fs.realpath(path.join(skillRoot, 'SKILL.md'));
    if (!isInsidePath(skillFile, skillRoot)) throw new Error('SKILL.md symlink escapes its skill directory.');
    const stat = await fs.stat(skillFile);
    if (!stat.isFile() || stat.size > MAX_SKILL_FILE_BYTES) throw new Error('SKILL.md is missing or too large.');
    return fs.readFile(skillFile, 'utf8');
  }
}

function parseSkillFile(content: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content);
  if (!match) throw new Error('SKILL.md must contain YAML frontmatter.');
  const raw = parse(match[1]) as unknown;
  if (!isObject(raw) || typeof raw.name !== 'string' || typeof raw.description !== 'string') {
    throw new Error('SKILL.md requires name and description.');
  }
  const allowedTools = typeof raw['allowed-tools'] === 'string'
    ? raw['allowed-tools'].split(/\s+/).filter(Boolean)
    : undefined;
  return {
    metadata: {
      name: raw.name,
      description: raw.description.slice(0, 1_024),
      compatibility: typeof raw.compatibility === 'string' ? raw.compatibility.slice(0, 500) : undefined,
      allowedTools,
    },
    body: match[2],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
