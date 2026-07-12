import { app } from 'electron';
import { createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type LearnedSkillSignature = { formatVersion: 1; skillName: string; skillVersion: string; algorithm: 'hmac-sha256'; signature: string; candidateDigest: string };

export function signLearnedSkill(content: string, version: string, digest: string, key: Buffer) { return createHmac('sha256', key).update(version).update('\0').update(digest).update('\0').update(content).digest('hex'); }

export async function verifyLearnedSkill(skillRoot: string, content: string, configuredKey?: Buffer) {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(skillRoot, '.agentstudio-signature.json'), 'utf8')) as LearnedSkillSignature;
    const key = configuredKey ?? await fs.readFile(path.join(app.getPath('userData'), 'skill-learning', 'signing.key'));
    return manifest.formatVersion === 1 && manifest.algorithm === 'hmac-sha256' && manifest.skillName === path.basename(skillRoot) && manifest.signature === signLearnedSkill(content, manifest.skillVersion, manifest.candidateDigest, key);
  } catch { return false; }
}
