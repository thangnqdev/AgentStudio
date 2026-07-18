import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { AgentSpanInput } from '../../domain/entities/agentTrace.js';
import { AgentToolCallRunner } from '../../application/services/AgentToolCallRunner.js';
import { AgentToolExecutor } from '../tools/AgentToolExecutor.js';
import { LOCAL_TOOL_DEFINITIONS } from '../tools/localToolDefinitions.js';
import { LocalAgentWorkerSessionProcessHost } from './LocalAgentWorkerSessionProcessHost.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => Promise.allSettled(cleanups.splice(0).map((cleanup) => cleanup())));

describe('production agent worker child entry', () => {
  it('runs the model loop in a real child while parent callbacks retain tool authority', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-production-child-'));
    cleanups.push(() => fs.rm(workspace, { recursive: true, force: true }));
    const server = await scriptedProvider();
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Provider fixture address is unavailable.');
    const compiledEntry = process.env.AGENTSTUDIO_COMPILED_WORKER_ENTRY;
    const entry = compiledEntry || fileURLToPath(new URL('../../agentWorkerProcess.ts', import.meta.url));
    const loader = fileURLToPath(new URL('../../../node_modules/tsx/dist/loader.mjs', import.meta.url));
    const host = new LocalAgentWorkerSessionProcessHost(entry, [], compiledEntry ? [] : ['--import', loader]);
    const worker = createWorker(workspace);
    const events: string[] = []; const checkpoints: unknown[] = []; const hookEvents: string[] = [];
    const executor = new AgentToolExecutor({ provider: 'disabled' });
    const tool = LOCAL_TOOL_DEFINITIONS.find((item) => item.name === 'write_file');
    if (!tool) throw new Error('write_file definition is unavailable.');
    const tracer = {
      newSpanId: () => crypto.randomUUID(), startTrace: async () => undefined, updateTrace: async () => undefined,
      recordSpan: vi.fn(async (_span: AgentSpanInput) => 'span'),
    };
    const runner = new AgentToolCallRunner(
      executor, { requestApproval: async () => true }, { record: async () => undefined }, tracer,
    );
    const result = await host.run({
      cwd: workspace,
      bootstrap: {
        worker, workspaceRoot: workspace,
        settings: {
          baseUrl: `http://127.0.0.1:${address.port}/v1`, apiKey: 'integration-secret',
          model: 'fixture-model', permissionMode: 'danger-full-access', requestTimeoutMs: 10_000, contextBudgetTokens: 1_000,
        },
      },
    }, {
      listTools: async () => [tool],
      runTool: (request) => runner.run({
        eventSink: { emitChunk() {}, emitAction() {}, emitDone() {}, emitError() {} },
        permissionMode: worker.permissionMode, requestId: worker.id, step: request.step,
        toolCall: request.toolCall, toolDefinition: tool, workspaceRoot: workspace,
        traceContext: { traceId: worker.traceId, taskId: worker.id },
      }),
      checkpoint: async (checkpoint) => { checkpoints.push(checkpoint); },
      drainMessages: async () => [], dispatchHook: async (event) => { hookEvents.push(event); }, recordSpan: tracer.recordSpan,
      emit: (event) => { if (event.event === 'chunk' && event.value) events.push(event.value); },
    }, new AbortController().signal);
    expect(result).toEqual({ status: 'completed', completedSteps: 1 });
    expect(await fs.readFile(path.join(workspace, 'child-proof.txt'), 'utf8')).toBe('written by isolated model loop\n');
    expect(events.join('')).toContain('Child process finished.');
    expect(checkpoints).toContainEqual(expect.objectContaining({ status: 'completed', completedSteps: 1 }));
    expect(tracer.recordSpan.mock.calls.filter(([span]) => span.kind === 'model_call')).toHaveLength(2);
    expect(hookEvents).toEqual(['PreCompact', 'PostCompact', 'PreCompact', 'PostCompact']);
  });
});

async function scriptedProvider() {
  let requestCount = 0;
  const server = http.createServer((request, response) => {
    const authorization = request.headers.authorization;
    if (authorization !== 'Bearer integration-secret') { response.writeHead(401).end(); return; }
    request.resume(); requestCount += 1;
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    if (requestCount === 1) {
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name: 'write_file', arguments: '{"path":"child-proof.txt","content":"written by isolated model loop\\n"}' } }] }, finish_reason: 'tool_calls' }] })}\n\n`);
    } else {
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Child process finished.' }, finish_reason: 'stop' }] })}\n\n`);
    }
    response.end('data: [DONE]\n\n');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

function createWorker(workspaceRoot: string): AgentWorkerRecord {
  return {
    id: 'worker-child-1', traceId: 'trace-child-1', parentScopeId: 'scope-child-1',
    description: 'write child proof', prompt: 'Write child-proof.txt', permissionMode: 'danger-full-access',
    workspaceRoot, depth: 1, background: true, status: 'running', createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z', completedSteps: 0,
    messages: Array.from({ length: 8 }, (_, index) => ({
      id: `prompt-child-${index}`, sender: (index % 2 ? 'agent' : 'user') as 'agent' | 'user',
      content: `${index === 6 ? 'Write child-proof.txt' : `history-${index}`} ${'x'.repeat(1_000)}`,
    })), conversation: [],
  };
}
