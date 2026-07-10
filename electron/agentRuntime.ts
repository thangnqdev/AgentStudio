import type { WebContents } from 'electron';
import type { AgentStartPayload, AgentProviderSettings } from './domain/entities/agent.js';
import { RunAgentSession } from './application/usecases/RunAgentSession.js';
import { OpenAIProvider } from './infrastructure/providers/OpenAIProvider.js';

export * from './domain/entities/agent.js';

export async function runAgentSession(
  payload: AgentStartPayload,
  sender: WebContents,
  settings: AgentProviderSettings,
  workspaceRoot: string,
  signal?: AbortSignal,
) {
  const provider = new OpenAIProvider();
  const session = new RunAgentSession(provider);
  await session.execute(payload, sender, settings, workspaceRoot, signal);
}
