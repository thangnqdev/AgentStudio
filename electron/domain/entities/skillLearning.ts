export const SKILL_CANDIDATE_VERSION = 1;
export const SKILL_EVALUATION_VERSION = 1;

export type GeneratedSkillTestKind = 'source_succeeded' | 'tool_sequence_represented' | 'bounded_instructions' | 'no_policy_override';
export type GeneratedSkillTest = { id: string; version: 1; kind: GeneratedSkillTestKind; description: string };
export type SkillCandidateEvaluation = { version: typeof SKILL_EVALUATION_VERSION; evaluatorId: string; evaluatorVersion: string; candidateDigest: string; passed: boolean; results: Array<{ testId: string; passed: boolean; message: string }>; evaluatedAt: string };
export type SkillCandidateApproval = { candidateDigest: string; decision: 'approved' | 'rejected'; approvedBy: 'local-user'; decidedAt: string };
export type SkillPromotion = { skillName: string; skillVersion: string; algorithm: 'hmac-sha256'; signature: string; candidateDigest: string; promotedAt: string };
export type SkillCandidate = {
  schemaVersion: typeof SKILL_CANDIDATE_VERSION; id: string; sourceTraceId: string; sourceTraceStatus: 'succeeded'; name: string; description: string; skillVersion: string;
  instructions: string; toolSequence: string[]; tests: GeneratedSkillTest[]; status: 'draft' | 'evaluated' | 'approved' | 'rejected' | 'promoted';
  createdAt: string; evaluation?: SkillCandidateEvaluation; approval?: SkillCandidateApproval; promotion?: SkillPromotion;
};

export function skillCandidateDigest(candidate: Pick<SkillCandidate, 'sourceTraceId' | 'sourceTraceStatus' | 'name' | 'description' | 'skillVersion' | 'instructions' | 'toolSequence' | 'tests'>) {
  let hash = 2_166_136_261; const value = JSON.stringify({ sourceTraceId: candidate.sourceTraceId, sourceTraceStatus: candidate.sourceTraceStatus, name: candidate.name, description: candidate.description, skillVersion: candidate.skillVersion, instructions: candidate.instructions, toolSequence: candidate.toolSequence, tests: candidate.tests });
  for (const character of value) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16_777_619); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function assertSkillCandidate(candidate: SkillCandidate) {
  assertOnlyKeys(candidate, ['schemaVersion', 'id', 'sourceTraceId', 'sourceTraceStatus', 'name', 'description', 'skillVersion', 'instructions', 'toolSequence', 'tests', 'status', 'createdAt', 'evaluation', 'approval', 'promotion']);
  if (candidate.schemaVersion !== SKILL_CANDIDATE_VERSION || !id(candidate.id) || !id(candidate.sourceTraceId) || candidate.sourceTraceStatus !== 'succeeded' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.name) || !/^\d+\.\d+\.\d+$/.test(candidate.skillVersion) || !Number.isFinite(Date.parse(candidate.createdAt))) throw new Error('Skill candidate identity is invalid.');
  if (!candidate.description.trim() || candidate.description.length > 1_024 || !candidate.instructions.trim() || candidate.instructions.length > 20_000) throw new Error('Skill candidate content is invalid.');
  if (!candidate.toolSequence.length || candidate.toolSequence.some((tool) => !/^[a-zA-Z0-9_.:-]{1,160}$/.test(tool)) || new Set(candidate.toolSequence).size !== candidate.toolSequence.length) throw new Error('Skill candidate tool sequence is invalid.');
  if (!candidate.tests.length || candidate.tests.some((test) => test.version !== 1 || !id(test.id))) throw new Error('Generated skill tests are invalid.');
  const digest = skillCandidateDigest(candidate);
  if (candidate.evaluation) {
    const evaluation = candidate.evaluation; const testIds = new Set(candidate.tests.map((test) => test.id));
    if (evaluation.version !== SKILL_EVALUATION_VERSION || !evaluation.evaluatorId || !evaluation.evaluatorVersion || evaluation.candidateDigest !== digest || !Number.isFinite(Date.parse(evaluation.evaluatedAt))) throw new Error('Skill evaluation provenance is invalid.');
    if (evaluation.results.length !== candidate.tests.length || evaluation.results.some((result) => !testIds.has(result.testId) || typeof result.passed !== 'boolean') || evaluation.passed !== evaluation.results.every((result) => result.passed)) throw new Error('Skill evaluation results are invalid.');
  }
  if (candidate.status === 'evaluated' && candidate.evaluation?.passed !== true) throw new Error('Skill candidate evaluation status is invalid.');
  if (candidate.status === 'rejected' && candidate.approval?.decision !== 'rejected' && candidate.evaluation?.passed !== false) throw new Error('Skill candidate rejection status is invalid.');
  if (candidate.approval && (candidate.approval.candidateDigest !== digest || candidate.approval.approvedBy !== 'local-user' || !['approved', 'rejected'].includes(candidate.approval.decision) || !Number.isFinite(Date.parse(candidate.approval.decidedAt)))) throw new Error('Skill approval is invalid.');
  if ((candidate.status === 'approved' || candidate.status === 'promoted') && (!candidate.evaluation?.passed || candidate.approval?.decision !== 'approved')) throw new Error('Skill candidate was not evaluated and approved.');
  if (candidate.status === 'promoted' && (!candidate.promotion || candidate.promotion.candidateDigest !== digest || candidate.promotion.skillVersion !== candidate.skillVersion || candidate.promotion.skillName !== candidate.name || candidate.promotion.algorithm !== 'hmac-sha256' || !candidate.promotion.signature || !Number.isFinite(Date.parse(candidate.promotion.promotedAt)))) throw new Error('Skill promotion is invalid.');
}

function id(value: string) { return /^[a-zA-Z0-9_.:-]{1,160}$/.test(value); }
function assertOnlyKeys(value: object, keys: string[]) { const allowed = new Set(keys); if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('Skill candidate contains non-allow-listed fields.'); }
