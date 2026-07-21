import { RunWorkflow } from './application/usecases/RunWorkflow.js';
import { JsonWorkflowCheckpointRepository } from './infrastructure/workflows/JsonWorkflowCheckpointRepository.js';
import { LocalWorkflowNodeExecutor } from './infrastructure/workflows/LocalWorkflowNodeExecutor.js';
import { LOCAL_READINESS_WORKFLOW } from './workflows/localReadinessWorkflow.js';
import { settingsRepo } from './infrastructure/JsonSettingsRepository.js';
import { workspaceManager } from './infrastructure/WorkspaceManager.js';
import { knowledgeBaseUseCase } from './knowledgeRuntime.js';
import { optimizerRepository } from './optimizerRuntime.js';

const executor = new LocalWorkflowNodeExecutor({
  'workspace.available': async () => Boolean(await workspaceManager.getSelectedWorkspaceRoot()),
  'provider.configured': async () => { const settings = await settingsRepo.loadStoredSettings(); return Boolean(settings.activeProviderId && settings.activeModelId); },
  'knowledge.available': async () => (await knowledgeBaseUseCase.list(await workspaceManager.getWorkspaceRoot())).totalChunks > 0,
  'workflow.ready': async () => true,
  'workflow.blocked': async () => false,
});

export const workflowDefinitions = [LOCAL_READINESS_WORKFLOW];
export const workflowRunner = new RunWorkflow(executor, new JsonWorkflowCheckpointRepository(), async () => (await optimizerRepository.load()).active.retryCount);
