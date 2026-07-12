import { SafeOptimizer } from './application/usecases/SafeOptimizer.js';
import { JsonlAgentEvaluationReportRepository } from './infrastructure/evaluation/JsonlAgentEvaluationReportRepository.js';
import { AgentReportOptimizationEvaluator } from './infrastructure/optimizer/AgentReportOptimizationEvaluator.js';
import { JsonOptimizerRepository } from './infrastructure/optimizer/JsonOptimizerRepository.js';
import { SettingsOptimizationModelCatalog } from './infrastructure/optimizer/SettingsOptimizationModelCatalog.js';
import { settingsRepo } from './infrastructure/JsonSettingsRepository.js';

export const optimizerRepository = new JsonOptimizerRepository();
export const safeOptimizer = new SafeOptimizer(optimizerRepository, new AgentReportOptimizationEvaluator(new JsonlAgentEvaluationReportRepository()), new SettingsOptimizationModelCatalog(settingsRepo));
