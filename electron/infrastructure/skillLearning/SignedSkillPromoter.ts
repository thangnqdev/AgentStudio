import { app } from 'electron';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { SkillCandidate, SkillPromotion } from '../../domain/entities/skillLearning.js';
import { skillCandidateDigest } from '../../domain/entities/skillLearning.js';
import type { ISkillCandidatePromoter } from '../../domain/ports/ISkillCandidatePromoter.js';
import { signLearnedSkill, type LearnedSkillSignature } from './learnedSkillSignature.js';

export class SignedSkillPromoter implements ISkillCandidatePromoter {
  private readonly configuredRoot?: string; private readonly configuredKey?: Buffer;
  constructor(configuredRoot?: string, configuredKey?: Buffer) { this.configuredRoot = configuredRoot; this.configuredKey = configuredKey; }
  async promote(candidate: Readonly<SkillCandidate>): Promise<SkillPromotion> {
    const root = this.root(); const target = path.join(root, candidate.name); const temporary = path.join(root, `.${candidate.name}-${crypto.randomUUID()}.tmp`);
    if (await exists(target)) throw new Error('A promoted skill with this name already exists.');
    const content = render(candidate); const key = await this.key(); const candidateDigest = skillCandidateDigest(candidate); const signature = signLearnedSkill(content, candidate.skillVersion, candidateDigest, key); const manifest: LearnedSkillSignature = { formatVersion: 1, skillName: candidate.name, skillVersion: candidate.skillVersion, algorithm: 'hmac-sha256', signature, candidateDigest };
    await fs.mkdir(temporary, { recursive: true }); await fs.writeFile(path.join(temporary, 'SKILL.md'), content, { encoding: 'utf8', mode: 0o600 }); await fs.writeFile(path.join(temporary, '.agentstudio-signature.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 }); await fs.rename(temporary, target);
    return { skillName: candidate.name, skillVersion: candidate.skillVersion, algorithm: 'hmac-sha256', signature, candidateDigest: manifest.candidateDigest, promotedAt: new Date().toISOString() };
  }
  private root() { return this.configuredRoot ?? path.join(app.getPath('userData'), 'skills'); }
  private async key() { if (this.configuredKey) return this.configuredKey; const keyPath = path.join(app.getPath('userData'), 'skill-learning', 'signing.key'); try { return await fs.readFile(keyPath); } catch (error) { if (!missing(error)) throw error; const key = randomBytes(32); await fs.mkdir(path.dirname(keyPath), { recursive: true }); await fs.writeFile(keyPath, key, { mode: 0o600 }); await fs.chmod(keyPath, 0o600).catch(() => undefined); return key; } }
}

function render(candidate: Readonly<SkillCandidate>) { return `---\nname: ${candidate.name}\ndescription: ${JSON.stringify(candidate.description)}\ncompatibility: ${JSON.stringify(`AgentStudio learned skill ${candidate.skillVersion}`)}\n---\n\n${candidate.instructions.trim()}\n`; }
async function exists(target: string) { try { await fs.access(target); return true; } catch { return false; } }
function missing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
