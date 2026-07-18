import fs from 'node:fs';
import {
  MAX_WORKER_PROCESS_MESSAGE_BYTES,
  parseWorkerProcessBootstrap,
} from './domain/entities/agentWorkerSessionProcess.js';
import { buildWorkerGuidance } from './application/services/agentWorkerGuidance.js';
import { RunAgentSession } from './application/usecases/RunAgentSession.js';
import { AttachmentMessageFormatter } from './infrastructure/ai/AttachmentMessageFormatter.js';
import {
  ParentProcessEventSink,
  ParentProcessLifecycleHookDispatcher,
  ParentProcessToolCatalog,
  ParentProcessToolRunner,
  ParentProcessTracer,
  drainParentProcessMessages,
} from './infrastructure/agents/AgentWorkerProcessAdapters.js';
import { WorkerProcessRpcClient } from './infrastructure/agents/WorkerProcessRpcClient.js';
import { OpenAIProvider } from './infrastructure/providers/OpenAIProvider.js';

const controller = new AbortController();
let processFailure: Error | undefined;
const rpc = new WorkerProcessRpcClient((error) => { processFailure = error; controller.abort(error); });
process.once('SIGTERM', () => controller.abort(new Error('Agent worker process was stopped.')));
process.once('SIGINT', () => controller.abort(new Error('Agent worker process was stopped.')));

let apiKey = '';
try {
  const bootstrap = await readBootstrap(); apiKey = bootstrap.settings.apiKey;
  const catalog = new ParentProcessToolCatalog(rpc);
  const tracer = new ParentProcessTracer(rpc);
  const eventSink = new ParentProcessEventSink(rpc);
  const unavailableExecutor = { execute: async () => ({ ok: false, output: 'Parent tool bridge is unavailable.' }) };
  const session = new RunAgentSession(
    new OpenAIProvider(), unavailableExecutor, catalog, new AttachmentMessageFormatter(),
    { requestApproval: async () => false }, { record: async () => undefined }, tracer,
    undefined, new ParentProcessLifecycleHookDispatcher(rpc), undefined, new ParentProcessToolRunner(rpc),
  );
  const result = await session.execute(
    { requestId: bootstrap.worker.id, messages: bootstrap.worker.messages }, eventSink,
    bootstrap.settings, bootstrap.workspaceRoot, undefined,
    buildWorkerGuidance(bootstrap.worker, bootstrap.guidanceContext), controller.signal,
    {
      id: bootstrap.worker.id, traceId: bootstrap.worker.traceId, workspaceRoot: bootstrap.worker.workspaceRoot,
      completedSteps: bootstrap.worker.completedSteps, messages: bootstrap.worker.messages,
      conversation: bootstrap.worker.conversation,
      onCheckpoint: (checkpoint) => rpc.request('checkpoint', checkpoint).then(() => undefined),
      drainMessages: () => drainParentProcessMessages(rpc),
    },
    { currentRoot: () => bootstrap.workspaceRoot },
  );
  if (!result) throw new Error('Agent worker child session ended without a result.');
  await rpc.finish({ kind: 'result', ok: true, status: result.status, completedSteps: result.completedSteps });
} catch (error) {
  const message = redact(error instanceof Error ? error.message : 'Agent worker child process failed.', apiKey);
  if (!processFailure) await rpc.finish({ kind: 'result', ok: false, error: message.slice(0, 2_000) });
  process.exitCode = 1;
}

async function readBootstrap() {
  const rawFd = process.env.AGENTSTUDIO_WORKER_BOOTSTRAP_FD;
  delete process.env.AGENTSTUDIO_WORKER_BOOTSTRAP_FD;
  if (!rawFd || !/^\d+$/.test(rawFd)) throw new Error('Agent worker bootstrap descriptor is invalid.');
  const fd = Number(rawFd); const chunks: Buffer[] = []; let total = 0;
  const deadline = Date.now() + 30_000;
  while (true) {
    const buffer = Buffer.allocUnsafe(64 * 1_024);
    let count = 0;
    try { count = fs.readSync(fd, buffer, 0, buffer.length, null); }
    catch (error) {
      if (!isTemporarilyUnavailable(error) || Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5)); continue;
    }
    if (count === 0) break;
    total += count; if (total > MAX_WORKER_PROCESS_MESSAGE_BYTES) throw new Error('Agent worker bootstrap is too large.');
    chunks.push(buffer.subarray(0, count));
  }
  let value: unknown; const serialized = Buffer.concat(chunks, total);
  try { value = JSON.parse(serialized.toString('utf8')); }
  catch { throw new Error('Agent worker bootstrap JSON is invalid.'); }
  finally { serialized.fill(0); for (const chunk of chunks) chunk.fill(0); }
  return parseWorkerProcessBootstrap(value);
}

function redact(value: string, secret: string) { return secret ? value.replaceAll(secret, '[REDACTED]') : value; }
function isTemporarilyUnavailable(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'EAGAIN';
}
