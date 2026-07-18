import fs from 'node:fs';

const fd = Number(process.env.AGENTSTUDIO_WORKER_BOOTSTRAP_FD);
const bootstrap = JSON.parse(fs.readFileSync(fd, 'utf8'));
if (!bootstrap.settings.apiKey || process.env.UNSAFE_AGENT_SECRET) process.exit(7);

let sequence = 0;
const pending = new Map();
process.on('message', (message) => {
  if (message?.kind !== 'response') return;
  const entry = pending.get(message.id); pending.delete(message.id);
  if (message.ok) entry?.resolve(message.result); else entry?.reject(new Error(message.error));
});
function request(method, payload = {}) {
  const id = `request-${++sequence}`;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    process.send({ kind: 'request', id, method, payload });
  });
}

const tools = await request('tools.list');
await request('tool.run', {
  requestId: bootstrap.worker.id, step: 0,
  toolCall: { id: 'call-1', type: 'function', function: { name: tools[0].name, arguments: '{}' } },
});
await request('checkpoint', {
  id: bootstrap.worker.id, traceId: bootstrap.worker.traceId, workspaceRoot: bootstrap.worker.workspaceRoot,
  status: 'running', completedSteps: 1, messages: bootstrap.worker.messages, conversation: [],
});
await request('messages.drain');
await request('hook.dispatch', { event: 'PreCompact' });
await request('hook.dispatch', { event: 'PostCompact' });
await request('trace.record', {
  kind: 'model_call', traceId: bootstrap.worker.traceId, taskId: bootstrap.worker.id,
  requestId: bootstrap.worker.id, step: 0, startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
  status: 'succeeded', model: bootstrap.settings.model,
});
process.send({ kind: 'event', event: 'chunk', requestId: bootstrap.worker.id, value: 'child-complete' });
process.send({ kind: 'event', event: 'done', requestId: bootstrap.worker.id });
process.send({ kind: 'result', ok: true, status: 'completed', completedSteps: 1 }, () => process.disconnect());
