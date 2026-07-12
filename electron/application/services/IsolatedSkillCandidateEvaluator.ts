import { SKILL_EVALUATION_VERSION, skillCandidateDigest, type GeneratedSkillTestKind, type SkillCandidate, type SkillCandidateEvaluation } from '../../domain/entities/skillLearning.js';
import type { ISkillCandidateEvaluator } from '../../domain/ports/ISkillCandidateEvaluator.js';

export class IsolatedSkillCandidateEvaluator implements ISkillCandidateEvaluator {
  async evaluate(candidate: Readonly<SkillCandidate>): Promise<SkillCandidateEvaluation> {
    const snapshot = structuredClone(candidate); const before = JSON.stringify(snapshot); Object.freeze(snapshot);
    const results = snapshot.tests.map((test) => ({ testId: test.id, ...run(test.kind, snapshot) }));
    if (JSON.stringify(snapshot) !== before) throw new Error('Skill evaluator mutated its candidate.');
    return { version: SKILL_EVALUATION_VERSION, evaluatorId: 'isolated-static-skill-evaluator', evaluatorVersion: '1.0.0', candidateDigest: skillCandidateDigest(snapshot), passed: results.every((result) => result.passed), results, evaluatedAt: new Date().toISOString() };
  }
}

function run(kind: GeneratedSkillTestKind, candidate: SkillCandidate) {
  if (kind === 'source_succeeded') return result(Boolean(candidate.sourceTraceId) && candidate.sourceTraceStatus === 'succeeded', 'Source trace provenance is successful.');
  if (kind === 'tool_sequence_represented') return result(candidate.toolSequence.every((tool) => candidate.instructions.includes(`\`${tool}\``)), 'Tool sequence is represented without arguments.');
  if (kind === 'bounded_instructions') return result(candidate.instructions.length > 0 && candidate.instructions.length <= 20_000, 'Instructions are within the 20k character limit.');
  const forbidden = /bypass|ignore (?:the )?(?:tool )?policy|disable approval|without approval|override permission/i;
  return result(!forbidden.test(candidate.instructions), 'No policy-bypass directive was detected.');
}
function result(passed: boolean, message: string) { return { passed, message }; }
