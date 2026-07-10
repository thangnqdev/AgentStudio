import type { WebContents } from 'electron';
import type { AgentStartPayload, AgentProviderSettings } from './domain/entities/agent.js';
import { RunAgentSession } from './application/usecases/RunAgentSession.js';
import { OpenAIProvider } from './infrastructure/providers/OpenAIProvider.js';
import { ElectronAgentEventSink } from './infrastructure/ElectronAgentEventSink.js';
import { AgentToolExecutor } from './infrastructure/tools/AgentToolExecutor.js';
import { AttachmentMessageFormatter } from './infrastructure/ai/AttachmentMessageFormatter.js';

export * from './domain/entities/agent.js';

export async function runAgentSession(
  payload: AgentStartPayload,
  sender: WebContents,
  settings: AgentProviderSettings,
  workspaceRoot: string,
  knowledgeContext?: string,
  signal?: AbortSignal,
) {
  const provider = new OpenAIProvider();
  const eventSink = new ElectronAgentEventSink(sender);
  const toolExecutor = new AgentToolExecutor();
  const session = new RunAgentSession(provider, toolExecutor, new AttachmentMessageFormatter());
  await session.execute(payload, eventSink, settings, workspaceRoot, knowledgeContext, signal);
}
