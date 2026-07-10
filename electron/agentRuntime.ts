import type { WebContents } from 'electron';
import type { AgentStartPayload, AgentProviderSettings } from './domain/entities/agent.js';
import { RunAgentSession } from './application/usecases/RunAgentSession.js';
import { OpenAIProvider } from './infrastructure/providers/OpenAIProvider.js';
import { ElectronAgentEventSink } from './infrastructure/ElectronAgentEventSink.js';
import { AgentToolExecutor } from './infrastructure/tools/AgentToolExecutor.js';

export * from './domain/entities/agent.js';

export async function runAgentSession(
  payload: AgentStartPayload,
  sender: WebContents,
  settings: AgentProviderSettings,
  workspaceRoot: string,
  signal?: AbortSignal,
) {
  const provider = new OpenAIProvider();
  const eventSink = new ElectronAgentEventSink(sender);
  const toolExecutor = new AgentToolExecutor();
  const session = new RunAgentSession(provider, toolExecutor);
  await session.execute(payload, eventSink, settings, workspaceRoot, signal);
}
