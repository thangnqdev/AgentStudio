import type { AgentEvaluation, EvaluationKind, EvaluationProvenance, GoldenTaskFixture } from '../../domain/entities/agentEvaluation.js';
import type { IAgentEvaluator } from '../../domain/ports/IAgentEvaluator.js';
import { scoreKnowledgeRetrieval } from './knowledgeEvaluationMetrics.js';

abstract class BaseEvaluator implements IAgentEvaluator {
  abstract readonly id: string;
  abstract readonly kind: EvaluationKind;
  readonly version = '1.0.0';
  abstract evaluate(fixture: Readonly<GoldenTaskFixture>, runId: string): Promise<AgentEvaluation>;
  protected provenance(fixture: Readonly<GoldenTaskFixture>, runId: string): EvaluationProvenance {
    return { runId, fixtureId: fixture.id, fixtureVersion: fixture.version, evaluatorId: this.id, evaluatorVersion: this.version, evaluatedAt: new Date().toISOString() };
  }
}

export class TaskOutcomeEvaluator extends BaseEvaluator {
  readonly id = 'task-outcome'; readonly kind = 'task' as const;
  async evaluate(fixture: Readonly<GoldenTaskFixture>, runId: string) {
    const statusMatched = fixture.expected.taskStatus === fixture.observed.taskStatus;
    return { kind: this.kind, score: statusMatched ? 1 : 0, passed: statusMatched, provenance: this.provenance(fixture, runId), statusMatched, expectedStatus: fixture.expected.taskStatus, observedStatus: fixture.observed.taskStatus };
  }
}

export class ToolSelectionEvaluator extends BaseEvaluator {
  readonly id = 'tool-selection'; readonly kind = 'tool_selection' as const;
  async evaluate(fixture: Readonly<GoldenTaskFixture>, runId: string) {
    const expected = new Set(fixture.expected.tools); const observed = new Set(fixture.observed.toolCalls.map((call) => call.toolName));
    const matches = [...observed].filter((tool) => expected.has(tool)).length;
    const precision = observed.size ? matches / observed.size : expected.size ? 0 : 1;
    const recall = expected.size ? matches / expected.size : 1;
    const forbiddenToolCalls = fixture.observed.toolCalls.filter((call) => fixture.expected.forbiddenTools.includes(call.toolName)).length;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    const score = forbiddenToolCalls ? 0 : f1;
    return { kind: this.kind, score, passed: score === 1, provenance: this.provenance(fixture, runId), precision, recall, forbiddenToolCalls };
  }
}

export class CodeChangeEvaluator extends BaseEvaluator {
  readonly id = 'code-change'; readonly kind = 'code_change' as const;
  async evaluate(fixture: Readonly<GoldenTaskFixture>, runId: string) {
    const expected = new Set(fixture.expected.changedFiles); const observed = new Set(fixture.observed.changedFiles);
    const matchedFileCount = [...observed].filter((file) => expected.has(file)).length;
    const unexpectedFileCount = [...observed].filter((file) => !expected.has(file)).length;
    const unionSize = new Set([...expected, ...observed]).size;
    const fileScore = unionSize ? matchedFileCount / unionSize : 1;
    const testsPassed = !fixture.expected.testsMustPass || fixture.observed.testsPassed;
    const score = testsPassed ? fileScore : 0;
    return { kind: this.kind, score, passed: score === 1, provenance: this.provenance(fixture, runId), expectedFileCount: expected.size, matchedFileCount, unexpectedFileCount, testsPassed };
  }
}

export class PolicyEvaluator extends BaseEvaluator {
  readonly id = 'policy'; readonly kind = 'policy' as const;
  async evaluate(fixture: Readonly<GoldenTaskFixture>, runId: string) {
    const checkCount = Math.max(fixture.observed.toolCalls.length, 1); const violationCount = fixture.observed.policyViolationCodes.length;
    const score = Math.max(0, 1 - violationCount / checkCount);
    return { kind: this.kind, score, passed: violationCount === 0, provenance: this.provenance(fixture, runId), checkCount, violationCount };
  }
}

export class TrajectoryEvaluator extends BaseEvaluator {
  readonly id = 'trajectory'; readonly kind = 'trajectory' as const;
  async evaluate(fixture: Readonly<GoldenTaskFixture>, runId: string) {
    const failedToolCalls = fixture.observed.toolCalls.filter((call) => call.outcome !== 'succeeded').length;
    const terminal = ['completed', 'paused', 'failed'].includes(fixture.observed.taskStatus);
    const stepScore = fixture.observed.completedSteps <= fixture.expected.maxSteps ? 1 : fixture.expected.maxSteps / Math.max(fixture.observed.completedSteps, 1);
    const failureScore = failedToolCalls <= fixture.expected.maxFailedToolCalls ? 1 : 0;
    const score = terminal ? (stepScore + failureScore) / 2 : 0;
    return { kind: this.kind, score, passed: score === 1, provenance: this.provenance(fixture, runId), stepCount: fixture.observed.completedSteps, maxSteps: fixture.expected.maxSteps, failedToolCalls, terminal };
  }
}

export class RetrievalEvaluator extends BaseEvaluator {
  readonly id = 'knowledge-retrieval'; readonly kind = 'retrieval' as const;
  async evaluate(fixture: Readonly<GoldenTaskFixture>, runId: string) {
    const metrics = scoreKnowledgeRetrieval(fixture.expected.relevantChunkIds, fixture.observed.retrievedChunkIds);
    const score = (metrics.recallAtK + metrics.reciprocalRank + metrics.ndcgAtK) / 3;
    return { kind: this.kind, score, passed: score === 1, provenance: this.provenance(fixture, runId), recallAtK: metrics.recallAtK, reciprocalRank: metrics.reciprocalRank, ndcgAtK: metrics.ndcgAtK };
  }
}

export function createDefaultAgentEvaluators(): IAgentEvaluator[] {
  return [new TaskOutcomeEvaluator(), new ToolSelectionEvaluator(), new CodeChangeEvaluator(), new PolicyEvaluator(), new TrajectoryEvaluator(), new RetrievalEvaluator()];
}
