import { CapabilityRegistry } from './application/usecases/CapabilityRegistry.js';
import { RecommendCapabilities } from './application/usecases/RecommendCapabilities.js';
import { LocalPlatformCapabilitySource } from './infrastructure/capabilities/LocalPlatformCapabilitySource.js';
import { TraceCapabilityMetricsProvider } from './infrastructure/capabilities/TraceCapabilityMetricsProvider.js';
import { JsonlAgentTraceRepository } from './infrastructure/tracing/JsonlAgentTraceRepository.js';
import { AgentToolExecutor } from './infrastructure/tools/AgentToolExecutor.js';
import { terminalManager } from './infrastructure/PtyTerminalManager.js';
import { webSearchSettingsRepository } from './infrastructure/WebSearchSettingsRepository.js';
import { workspaceManager } from './infrastructure/WorkspaceManager.js';
import { knowledgeBaseUseCase } from './knowledgeRuntime.js';
import { mcpGateway } from './mcpRuntime.js';
import { skillManager } from './skillRuntime.js';
import { getTaskToolDefinitions } from './application/services/TaskToolPlatform.js';
import { getBackgroundCommandToolDefinitions } from './application/services/BackgroundCommandToolPlatform.js';
import { getInteractiveToolDefinitions } from './application/services/interactiveToolDefinitions.js';

const source = new LocalPlatformCapabilitySource({
  tools: async () => {
    const workspaceRoot = await workspaceManager.getWorkspaceRoot();
    const settings = await webSearchSettingsRepository.load();
    const baseTools = await new AgentToolExecutor(settings, undefined, mcpGateway, mcpGateway).list(workspaceRoot);
    const sessionTools = [...getTaskToolDefinitions(), ...getBackgroundCommandToolDefinitions(), ...getInteractiveToolDefinitions()];
    const sessionNames = new Set(sessionTools.map((tool) => tool.name));
    return [...baseTools.filter((tool) => !sessionNames.has(tool.name)), ...sessionTools];
  },
  skills: async () => skillManager.list(await workspaceManager.getWorkspaceRoot()),
  knowledgeAvailable: async () => (await knowledgeBaseUseCase.list(await workspaceManager.getWorkspaceRoot())).totalChunks > 0,
  terminalAvailable: async () => (await terminalManager.getAvailableCommandShells()).length > 0,
});

export const capabilityRegistry = new CapabilityRegistry(
  [source],
  new TraceCapabilityMetricsProvider(new JsonlAgentTraceRepository()),
);
export const capabilityRecommender = new RecommendCapabilities(capabilityRegistry);
