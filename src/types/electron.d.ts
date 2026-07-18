import type { Message } from '../domain/entities/message';
import type { ChatThread } from '../domain/entities/chatThread';
import type { AIModel, AppSettings, PermissionMode } from '../domain/entities/settings';
import type { KnowledgeDocument } from '../domain/entities/knowledge';
import type { AppUpdateSnapshot } from '../domain/entities/appUpdate';
import type { SkillStatus } from '../domain/entities/skill';
import type { McpAuthOutput, McpServerStatus, SaveMcpServerPayload } from '../domain/entities/mcp';
import type { AgentTraceDetails, AgentTraceSummary } from '../domain/entities/agentTrace';
import type { AgentEvaluationReport } from '../domain/entities/agentEvaluation';
import type { NodeCheckpoint, WorkflowDefinition } from '../domain/entities/workflow';
import type { CapabilityRecommendation, CapabilityRecommendationRequest, CapabilitySnapshot } from '../domain/entities/capability';
import type { OptimizationCandidate, OptimizerState, RuntimeOptimizationConfig } from '../domain/entities/optimizer';
import type { SkillCandidate } from '../domain/entities/skillLearning';
import type { AgentProfileStatus } from '../domain/entities/agentProfile';
import type { PluginStatus } from '../domain/entities/plugin';
import type { AgentInteractionRequest, AgentInteractionResponse } from '../domain/entities/agentInteraction';
import type { AgentWorktreeState } from '../domain/entities/agentWorktree';
import type { AgentWorkerEvent, AgentWorkerSummary } from '../domain/entities/agentWorker';
import type { AgentTeamEvent, AgentTeamView } from '../domain/entities/agentTeam';
import type { PublicRemoteTriggerSettings, SaveRemoteTriggerSettingsPayload } from '../domain/entities/remoteTrigger';
import type { BackgroundCommandNotice } from '../domain/entities/backgroundCommand';
import type { LifecycleHookSummary } from '../domain/entities/lifecycleHook';
import type { ManualCompactionPayload, ManualCompactionResult } from '../domain/entities/manualCompaction';

export type SaveProviderPayload = {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  models?: Array<string | AIModel>;
};

export type LegacySettingsPayload = {
  providers?: Array<{
    id?: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    models?: Array<string | AIModel>;
  }>;
  activeProviderId?: string | null;
  activeModelId?: string | null;
  fallbackModelId?: string | null;
  permissionMode?: PermissionMode;
};

export type ChatEventPayload = {
  requestId: string;
  chunk?: string;
  error?: string;
  action?: ChatActionPayload;
  task?: ChatTaskStatusPayload;
  interaction?: AgentInteractionRequest;
  planMode?: { active: boolean };
  worktree?: AgentWorktreeState;
};

export type ChatActionPayload = {
  id: string;
  toolName: string;
  args: string;
  risk: 'read' | 'write' | 'execute' | 'network';
  status: 'awaiting_approval' | 'denied' | 'running' | 'ok' | 'error';
  output?: string;
};

export type ChatTaskStatusPayload = {
  taskId: string;
  status: 'paused' | 'completed';
  completedSteps: number;
};

export type ChatEventListener = (payload: ChatEventPayload) => void;
export type AgentWorkerEventListener = (payload: AgentWorkerEvent) => void;
export type AgentTeamEventListener = (payload: AgentTeamEvent) => void;
export type BackgroundCommandNoticeListener = (payload: BackgroundCommandNotice) => void;

export type TerminalCreatePayload = {
  cols: number;
  rows: number;
  shellId?: string;
};

export type TerminalCreatedPayload = {
  terminalId: string;
  shellId: string;
  shell: string;
  shellLabel: string;
  cwd: string;
};

export type CommandShellPayload = {
  id: string;
  label: string;
  command: string;
};

export type TerminalEventPayload = {
  terminalId: string;
  data?: string;
  exitCode?: number;
  signal?: number | string;
};

export type TerminalEventListener = (payload: TerminalEventPayload) => void;

export type WriteWorkspaceFilePayload = {
  path: string;
  content: string;
};

export type WorkspacePayload = {
  path: string;
  canceled?: boolean;
};

export type ChatHistoryPayload = {
  threads: ChatThread[];
  activeThreadId: string | null;
};

export type AgentTaskSummary = {
  id: string;
  traceId: string;
  title: string;
  workspaceRoot: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  completedSteps: number;
  parentTaskId?: string;
  branchDepth?: number;
  lastError?: string;
};

export type AgentTaskListResult =
  | { success: true; tasks: AgentTaskSummary[] }
  | { success: false; error: string };

export type WebSearchProvider = 'disabled' | 'openai' | 'tavily' | 'searxng';

export type PublicWebSearchSettings = {
  provider: WebSearchProvider;
  baseUrl?: string;
  model?: string;
  hasApiKey: boolean;
};

export type WebSearchSettingsResult =
  | { success: true; settings: PublicWebSearchSettings }
  | { success: false; error: string };

export type KnowledgeLibraryPayload = {
  documents: KnowledgeDocument[];
  totalChunks: number;
  semanticReady: boolean;
  watching: boolean;
};

export type KnowledgeImportPayload = {
  canceled: boolean;
  imported: KnowledgeDocument[];
  warnings: string[];
};

export type KnowledgeWorkspaceSyncPayload = KnowledgeImportPayload & {
  scanned: number;
  truncated: boolean;
  watching: boolean;
};

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AttachmentAuthorizationPayload = {
  id: string;
  name: string;
  type: 'text' | 'image' | 'audio' | 'video';
  authorizationToken: string;
  mimeType?: string;
  size?: number;
};

declare global {
  interface Window {
    agentStudio?: {
      ping: () => Promise<string>;
      getAppVersion: () => Promise<string>;
      getPlatform: () => string;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      notifyRendererReady: () => void;
      getAppUpdateStatus: () => Promise<IpcResult<AppUpdateSnapshot>>;
      checkForAppUpdates: () => Promise<IpcResult<AppUpdateSnapshot>>;
      downloadAppUpdate: () => Promise<IpcResult<AppUpdateSnapshot>>;
      installAppUpdate: () => Promise<IpcResult<{ ok: true }>>;
      onAppUpdateStatus: (listener: (payload: AppUpdateSnapshot) => void) => () => void;
      loadSettings: () => Promise<AppSettings>;
      importLegacySettings: (settings: LegacySettingsPayload) => Promise<AppSettings>;
      saveProvider: (provider: SaveProviderPayload) => Promise<IpcResult<AppSettings>>;
      saveProviderAndScan: (provider: SaveProviderPayload) => Promise<AppSettings>;
      deleteProvider: (providerId: string) => Promise<AppSettings>;
      setActiveProvider: (providerId: string) => Promise<AppSettings>;
      setActiveModel: (modelId: string) => Promise<AppSettings>;
      setFallbackModel: (modelId: string) => Promise<AppSettings>;
      setPermissionMode: (mode: PermissionMode) => Promise<AppSettings>;
      onSettingsChanged: (listener: (settings: AppSettings) => void) => () => void;
      loadWebSearchSettings: () => Promise<WebSearchSettingsResult>;
      saveWebSearchSettings: (payload: { provider: WebSearchProvider; baseUrl?: string; apiKey?: string; model?: string }) => Promise<WebSearchSettingsResult>;
      loadRemoteTriggerSettings: () => Promise<IpcResult<PublicRemoteTriggerSettings>>;
      saveRemoteTriggerSettings: (payload: SaveRemoteTriggerSettingsPayload) => Promise<IpcResult<PublicRemoteTriggerSettings>>;
      getCurrentWorkspace: () => Promise<WorkspacePayload>;
      selectWorkspace: () => Promise<WorkspacePayload>;
      writeWorkspaceFile: (payload: WriteWorkspaceFilePayload) => Promise<{ success: true; path: string } | { success: false; error: string }>;
      authorizeAttachment: (file: File) => Promise<IpcResult<AttachmentAuthorizationPayload>>;
      loadChatHistory: () => Promise<ChatHistoryPayload>;
      saveChatHistory: (payload: { threads: ChatThread[]; activeThreadId: string | null }) => Promise<{ ok: boolean }>;
      listLifecycleHooks: () => Promise<IpcResult<LifecycleHookSummary[]>>;
      compactConversation: (payload: ManualCompactionPayload) => Promise<IpcResult<ManualCompactionResult>>;
      getGitBranch: () => Promise<string | null>;
      listKnowledge: () => Promise<IpcResult<KnowledgeLibraryPayload>>;
      selectAndImportKnowledge: () => Promise<IpcResult<KnowledgeImportPayload>>;
      syncWorkspaceKnowledge: () => Promise<IpcResult<KnowledgeWorkspaceSyncPayload>>;
      stopWorkspaceKnowledgeSync: () => Promise<IpcResult<{ watching: boolean }>>;
      removeKnowledgeDocument: (documentId: string) => Promise<IpcResult<{ ok: boolean }>>;
      listSkills: () => Promise<IpcResult<SkillStatus[]>>;
      setSkillEnabled: (payload: { skillId: string; enabled: boolean }) => Promise<IpcResult<SkillStatus[]>>;
      setSkillTrusted: (payload: { skillId: string; trusted: boolean }) => Promise<IpcResult<SkillStatus[]>>;
      listAgentProfiles: () => Promise<IpcResult<AgentProfileStatus[]>>;
      setAgentProfileEnabled: (payload: { profileId: string; value: boolean }) => Promise<IpcResult<AgentProfileStatus[]>>;
      setAgentProfileTrusted: (payload: { profileId: string; value: boolean }) => Promise<IpcResult<AgentProfileStatus[]>>;
      listPlugins: () => Promise<IpcResult<PluginStatus[]>>;
      setPluginEnabled: (payload: { pluginId: string; value: boolean }) => Promise<IpcResult<PluginStatus[]>>;
      setPluginTrusted: (payload: { pluginId: string; value: boolean }) => Promise<IpcResult<PluginStatus[]>>;
      listMcpServers: () => Promise<IpcResult<McpServerStatus[]>>;
      saveMcpServer: (payload: SaveMcpServerPayload) => Promise<IpcResult<McpServerStatus[]>>;
      removeMcpServer: (serverId: string) => Promise<IpcResult<McpServerStatus[]>>;
      startMcpServer: (serverId: string) => Promise<IpcResult<McpServerStatus[]>>;
      stopMcpServer: (serverId: string) => Promise<IpcResult<McpServerStatus[]>>;
      authenticateMcpServer: (serverId: string) => Promise<IpcResult<McpAuthOutput>>;
      startChat: (payload: { requestId: string; taskId?: string; taskListId?: string; messages: Message[] }) => void;
      stopChat: (requestId: string) => void;
      respondToToolApproval: (payload: { requestId: string; actionId: string; approved: boolean; rememberDomain?: boolean }) => void;
      respondToAgentInteraction: (payload: { requestId: string; interactionId: string; response: AgentInteractionResponse }) => void;
      onChatChunk: (listener: ChatEventListener) => () => void;
      onChatAction: (listener: ChatEventListener) => () => void;
      onChatDone: (listener: ChatEventListener) => () => void;
      onChatError: (listener: ChatEventListener) => () => void;
      onChatTaskStatus: (listener: ChatEventListener) => () => void;
      onChatInteraction: (listener: ChatEventListener) => () => void;
      onChatPlanMode: (listener: ChatEventListener) => () => void;
      onChatWorktree: (listener: ChatEventListener) => () => void;
      getAgentWorktreeState: (scopeId: string) => Promise<IpcResult<AgentWorktreeState>>;
      listAgentWorkers: (scopeId: string) => Promise<IpcResult<AgentWorkerSummary[]>>;
      stopAgentWorker: (payload: { scopeId: string; agentId: string }) => Promise<IpcResult<{ stopped: true }>>;
      respondToAgentWorkerApproval: (payload: { agentId: string; actionId: string; approved: boolean }) => void;
      onAgentWorkerEvent: (listener: AgentWorkerEventListener) => () => void;
      getAgentTeam: (scopeId: string) => Promise<IpcResult<AgentTeamView | null>>;
      onAgentTeamEvent: (listener: AgentTeamEventListener) => () => void;
      onBackgroundCommandNotice: (listener: BackgroundCommandNoticeListener) => () => void;
      listResumableAgentTasks: () => Promise<AgentTaskListResult>;
      forkAgentTask: (taskId: string) => Promise<IpcResult<AgentTaskSummary>>;
      listAgentTraces: (limit?: number) => Promise<IpcResult<AgentTraceSummary[]>>;
      getAgentTrace: (traceId: string) => Promise<IpcResult<AgentTraceDetails>>;
      exportAgentTrace: (traceId: string) => Promise<IpcResult<{ canceled: boolean; recordCount: number }>>;
      listAgentEvaluations: (limit?: number) => Promise<IpcResult<AgentEvaluationReport[]>>;
      runGoldenAgentEvaluation: (candidateId?: string) => Promise<IpcResult<AgentEvaluationReport>>;
      exportAgentEvaluation: (runId: string) => Promise<IpcResult<{ canceled: boolean }>>;
      listWorkflowDefinitions: () => Promise<IpcResult<WorkflowDefinition[]>>;
      listWorkflowRuns: (limit?: number) => Promise<IpcResult<NodeCheckpoint[]>>;
      startWorkflow: (workflowId: string) => Promise<IpcResult<NodeCheckpoint>>;
      resumeWorkflow: (payload: { workflowId: string; runId: string; nodeId: string; approved: boolean }) => Promise<IpcResult<NodeCheckpoint>>;
      listCapabilities: () => Promise<IpcResult<CapabilitySnapshot[]>>;
      recommendCapabilities: (payload: CapabilityRecommendationRequest) => Promise<IpcResult<CapabilityRecommendation[]>>;
      getOptimizerState: () => Promise<IpcResult<OptimizerState>>;
      createOptimizationCandidate: (payload: Partial<RuntimeOptimizationConfig>) => Promise<IpcResult<OptimizationCandidate>>;
      evaluateOptimizationCandidate: (payload: { candidateId: string; baselineRunId: string; candidateRunId: string }) => Promise<IpcResult<OptimizationCandidate>>;
      promoteOptimizationCandidate: (candidateId: string) => Promise<IpcResult<OptimizerState>>;
      rollbackOptimization: () => Promise<IpcResult<OptimizerState>>;
      listSkillCandidates: () => Promise<IpcResult<SkillCandidate[]>>;
      createSkillCandidate: (traceId: string) => Promise<IpcResult<SkillCandidate>>;
      evaluateSkillCandidate: (candidateId: string) => Promise<IpcResult<SkillCandidate>>;
      decideSkillCandidate: (payload: { candidateId: string; approved: boolean }) => Promise<IpcResult<SkillCandidate>>;
      promoteSkillCandidate: (candidateId: string) => Promise<IpcResult<SkillCandidate>>;
      listCommandShells: () => Promise<CommandShellPayload[]>;
      createTerminal: (payload: TerminalCreatePayload) => Promise<TerminalCreatedPayload>;
      writeTerminal: (payload: { terminalId: string; data: string }) => void;
      resizeTerminal: (payload: { terminalId: string; cols: number; rows: number }) => void;
      killTerminal: (terminalId: string) => void;
      onTerminalData: (listener: TerminalEventListener) => () => void;
      onTerminalExit: (listener: TerminalEventListener) => () => void;
    };
  }
}
