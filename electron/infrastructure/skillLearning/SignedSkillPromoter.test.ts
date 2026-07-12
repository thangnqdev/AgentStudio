import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateSkillCandidate } from '../../application/services/skillCandidateGenerator.js';
import { successfulTrace } from '../../test/fixtures/skillLearningTrace.js';
import { SignedSkillPromoter } from './SignedSkillPromoter.js';
import { verifyLearnedSkill } from './learnedSkillSignature.js';
import { FileSystemSkillCatalog } from '../skills/FileSystemSkillCatalog.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));
describe('SignedSkillPromoter integration', () => {
  it('writes a versioned signed skill and detects tampering', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'learned-skills-')); directories.push(root); const key = Buffer.alloc(32, 7);
    const candidate = generateSkillCandidate(successfulTrace(), 'candidate-1', new Date().toISOString()); const promoter = new SignedSkillPromoter(root, key);
    const promotion = await promoter.promote(candidate); const skillRoot = path.join(root, candidate.name); const skillFile = path.join(skillRoot, 'SKILL.md'); const content = await fs.readFile(skillFile, 'utf8');
    expect(promotion).toMatchObject({ algorithm: 'hmac-sha256', skillVersion: '1.0.0' }); expect(await verifyLearnedSkill(skillRoot, content, key)).toBe(true);
    const catalog = new FileSystemSkillCatalog([{ root, origin: 'user' }], (candidateRoot, candidateContent) => verifyLearnedSkill(candidateRoot, candidateContent, key));
    expect(await catalog.discover('/unused')).toHaveLength(1);
    await fs.writeFile(skillFile, `${content}\ntampered`, 'utf8');
    expect(await catalog.discover('/unused')).toHaveLength(0);
  });
});
