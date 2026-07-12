import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateSkillCandidate } from '../../application/services/skillCandidateGenerator.js';
import { successfulTrace } from '../../test/fixtures/skillLearningTrace.js';
import { JsonSkillCandidateRepository } from './JsonSkillCandidateRepository.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));
describe('JsonSkillCandidateRepository integration', () => {
  it('round-trips candidates in owner-only storage', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-candidates-')); directories.push(directory); const target = path.join(directory, 'candidates.json'); const repository = new JsonSkillCandidateRepository(target);
    await repository.save(generateSkillCandidate(successfulTrace(), 'candidate-1', new Date().toISOString())); expect(await repository.list()).toHaveLength(1);
    if (process.platform !== 'win32') expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
  });
});
