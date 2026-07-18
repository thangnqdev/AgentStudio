import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { RunAgentSession } from '../../application/usecases/RunAgentSession.js';
import { retrieveKnowledge } from '../../application/services/knowledgeRetrieval.js';
import type { AgentSpanInput, ToolCallTrace } from '../../domain/entities/agentTrace.js';
import type { GoldenRuntimeTaskDefinition, GoldenTaskFixture, RuntimeEvaluationFile } from '../../domain/entities/agentEvaluation.js';
import type { IAgentEvaluationScenarioRunner } from '../../domain/ports/IAgentEvaluationScenarioRunner.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import { assertOptimizationConfig, type RuntimeOptimizationConfig } from '../../domain/entities/optimizer.js';
import type { SkillStatus } from '../../domain/entities/skill.js';
import { rankRelevantSkills } from '../../application/services/skillRanking.js';
import { AttachmentMessageFormatter } from '../ai/AttachmentMessageFormatter.js';
import { resolveSafeWorkspacePath } from '../security/resolveSafePath.js';
import { ScriptedEvaluationProvider } from './ScriptedEvaluationProvider.js';
import { createEvaluationToolRuntime } from './createEvaluationToolRuntime.js';
import { BackgroundCommandProcessHost } from '../tasks/BackgroundCommandProcessHost.js';
import { fileURLToPath } from 'node:url';

type Observation = GoldenTaskFixture['observed'];

export class DeterministicAgentScenarioRunner implements IAgentEvaluationScenarioRunner {
  private readonly backgroundProcessHost: BackgroundCommandProcessHost;

  constructor(backgroundProcessHost: BackgroundCommandProcessHost = sourceBackgroundProcessHost()) {
    this.backgroundProcessHost = backgroundProcessHost;
  }

  async run(
    definition: Readonly<GoldenRuntimeTaskDefinition>,
    config: Readonly<RuntimeOptimizationConfig>,
  ): Promise<Observation> {
    assertOptimizationConfig(config as RuntimeOptimizationConfig);
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-runtime-eval-'));
    const workItemRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-runtime-eval-tasks-'));
    const backgroundOutputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-runtime-eval-background-'));
    const planOutputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-runtime-eval-plans-'));
    const worktreeOutputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-runtime-eval-worktrees-'));
    const workerOutputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-runtime-eval-workers-'));
    const teamOutputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-runtime-eval-teams-'));
    const taskId = `runtime-eval-${randomUUID()}`;
    const traceId = randomUUID();
    const tracer = new MemoryEvaluationTracer();
    let taskStatus: Observation['taskStatus'] = 'failed';
    let completedSteps = 0;
    let runtimeFailed = false;
    let retrievedChunkIds: string[] = [];
    let stopRuntime = async () => undefined;

    try {
      await writeInitialFiles(workspaceRoot, definition.runtime.initialFiles);
      const before = await snapshotWorkspace(workspaceRoot);
      const retrieval = definition.runtime.knowledge
        ? retrieveKnowledge(
          definition.runtime.knowledge.store.chunks,
          definition.runtime.knowledge.store.documents,
          definition.runtime.knowledge.query,
          null,
          undefined,
          Math.min(definition.runtime.knowledge.limit, config.retrievalTopK),
          { lexicalWeight: config.lexicalWeight, semanticWeight: config.semanticWeight },
        )
        : undefined;
      retrievedChunkIds = retrieval?.results.map((result) => result.chunkId) ?? [];
      const knowledgeContext = retrieval?.results.map((result) => `${result.citation}\n${result.content}`).join('\n\n')
        || definition.runtime.knowledgeContext;
      const provider = new ScriptedEvaluationProvider(definition.runtime.responses);
      const workerProvider = new ScriptedEvaluationProvider(definition.runtime.workerResponses ?? []);
      const runtime = createEvaluationToolRuntime({
        workspaceRoot, taskId, config, workerProvider, tracer, backgroundProcessHost: this.backgroundProcessHost,
        interactionResponses: [...(definition.runtime.interactions ?? [])],
        webPages: [...(definition.runtime.webPages ?? [])],
        roots: { workItems: workItemRoot, background: backgroundOutputRoot, plans: planOutputRoot, worktrees: worktreeOutputRoot, workers: workerOutputRoot, teams: teamOutputRoot },
      });
      const { platform, permissionPolicy, workers, backgroundSupervisor } = runtime;
      stopRuntime = async () => { await workers.stopAll(); await backgroundSupervisor.stopAll(); };
      const session = new RunAgentSession(
        provider,
        platform,
        platform,
        new AttachmentMessageFormatter(),
        { requestApproval: async () => true },
        { record: async () => undefined },
        tracer,
        permissionPolicy,
      );

      try {
        const result = await session.execute(
          { requestId: taskId, messages: [{ id: 'evaluation-prompt', sender: 'user', content: definition.runtime.prompt }] },
          NOOP_EVENT_SINK,
          {
            baseUrl: 'scripted://runtime-evaluation', apiKey: '', model: config.modelChoice ?? 'scripted-runtime',
            permissionMode: definition.runtime.permissionMode, retryCount: config.retryCount,
            requestTimeoutMs: config.timeoutMs, contextWindow: 16_384,
            contextBudgetTokens: config.contextBudgetTokens,
          },
          workspaceRoot,
          knowledgeContext,
          buildEvaluationSkillContext(definition.runtime.prompt, config.skillRankingWeight),
          undefined,
          {
            id: taskId, traceId, workspaceRoot, completedSteps: 0, messages: [], conversation: [],
            knowledgeContext,
            onCheckpoint: async (checkpoint) => {
              taskStatus = checkpoint.status === 'running' ? taskStatus : checkpoint.status;
              completedSteps = checkpoint.completedSteps;
            },
            drainMessages: () => workers.drainParentMessages(taskId),
          },
          platform,
        );
        taskStatus = result?.status ?? 'failed';
        completedSteps = result?.completedSteps ?? completedSteps;
        await waitForBackgroundWorkers(workers, taskId);
        provider.assertComplete();
        workerProvider.assertComplete();
      } catch {
        runtimeFailed = true;
        taskStatus = 'failed';
      }

      const after = await snapshotWorkspace(workspaceRoot);
      const toolCalls = tracer.toolCalls();
      const forbidden = new Set(definition.expected.forbiddenTools);
      const policyViolationCodes = toolCalls
        .filter((call) => call.outcome === 'succeeded' && forbidden.has(call.toolName))
        .map((call) => `forbidden-tool-succeeded:${call.toolName}`);
      if (runtimeFailed) policyViolationCodes.push('runtime-error');

      return {
        taskId,
        traceId,
        taskStatus,
        completedSteps,
        toolCalls: toolCalls.map(({ toolName, outcome }) => ({ toolName, outcome })),
        changedFiles: changedFiles(before, after),
        testsPassed: definition.runtime.assertedFiles.length > 0
          && await assertedFilesMatch(workspaceRoot, definition.runtime.assertedFiles),
        policyViolationCodes,
        retrievedChunkIds,
      };
    } finally {
      await stopRuntime();
      await Promise.all([
        fs.rm(workspaceRoot, { recursive: true, force: true }),
        fs.rm(workItemRoot, { recursive: true, force: true }),
        fs.rm(backgroundOutputRoot, { recursive: true, force: true }),
        fs.rm(planOutputRoot, { recursive: true, force: true }),
        fs.rm(worktreeOutputRoot, { recursive: true, force: true }),
        fs.rm(workerOutputRoot, { recursive: true, force: true }),
        fs.rm(teamOutputRoot, { recursive: true, force: true }),
      ]);
    }
  }
}

function sourceBackgroundProcessHost() {
  const entry = fileURLToPath(new URL('../../backgroundCommandProcess.ts', import.meta.url));
  const loader = fileURLToPath(new URL('../../../node_modules/tsx/dist/loader.mjs', import.meta.url));
  return new BackgroundCommandProcessHost(entry, ['--import', loader]);
}

async function waitForBackgroundWorkers(workers: ReturnType<typeof createEvaluationToolRuntime>['workers'], scopeId: string) {
  for (let index = 0; index < 200; index += 1) {
    if ((await workers.list(scopeId)).every((worker) => worker.status !== 'running')) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const EVALUATION_SKILLS: SkillStatus[] = [
  { id: 'architecture', name: 'architecture', description: 'domain layer infrastructure dependency boundaries', origin: 'user', rootPath: '', enabled: true, trusted: true },
  { id: 'patching', name: 'patching', description: 'read files and apply exact code patches', origin: 'user', rootPath: '', enabled: true, trusted: true },
];

function buildEvaluationSkillContext(prompt: string, weight: number) {
  return rankRelevantSkills(EVALUATION_SKILLS, prompt, weight)
    .map((skill) => `<skill id="${skill.id}">${skill.description}</skill>`)
    .join('\n');
}

class MemoryEvaluationTracer implements IAgentTracer {
  private readonly spans: AgentSpanInput[] = [];
  newSpanId() { return randomUUID(); }
  async startTrace() {}
  async updateTrace() {}
  async recordSpan(input: AgentSpanInput) { this.spans.push(structuredClone(input)); return input.spanId ?? randomUUID(); }
  toolCalls(): Array<Pick<ToolCallTrace, 'toolName' | 'outcome'>> {
    return this.spans.filter((span): span is Extract<AgentSpanInput, { kind: 'tool_call' }> => span.kind === 'tool_call');
  }
}

const NOOP_EVENT_SINK: IAgentEventSink = {
  emitChunk: () => undefined,
  emitAction: () => undefined,
  emitDone: () => undefined,
  emitError: () => undefined,
  emitInteraction: () => undefined,
};

async function writeInitialFiles(workspaceRoot: string, files: readonly RuntimeEvaluationFile[]) {
  for (const file of files) {
    const target = await resolveSafeWorkspacePath(file.path, workspaceRoot, { allowMissingFinalPath: true });
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
}

async function assertedFilesMatch(workspaceRoot: string, files: readonly RuntimeEvaluationFile[]) {
  const matches = await Promise.all(files.map(async (file) => {
    const target = await resolveSafeWorkspacePath(file.path, workspaceRoot);
    return await fs.readFile(target, 'utf8') === file.content;
  }));
  return matches.every(Boolean);
}

async function snapshotWorkspace(workspaceRoot: string) {
  const snapshot = new Map<string, string>();
  await visit(workspaceRoot, '');
  return snapshot;

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relative = path.posix.join(relativeDirectory, entry.name);
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) snapshot.set(relative, (await fs.readFile(absolute)).toString('base64'));
      else snapshot.set(relative, `[${entry.isSymbolicLink() ? 'symlink' : 'other'}]`);
    }
  }
}

function changedFiles(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>) {
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((file) => before.get(file) !== after.get(file))
    .sort();
}
