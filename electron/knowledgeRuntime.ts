import { KnowledgeBaseUseCase } from './application/usecases/KnowledgeBaseUseCase.js';
import { JsonKnowledgeRepository } from './infrastructure/knowledge/JsonKnowledgeRepository.js';
import { OpenAIEmbeddingClient } from './infrastructure/knowledge/OpenAIEmbeddingClient.js';
import { SettingsKnowledgeConfigProvider } from './infrastructure/knowledge/SettingsKnowledgeConfigProvider.js';
import { Utf8KnowledgeSourceReader } from './infrastructure/knowledge/Utf8KnowledgeSourceReader.js';

export const knowledgeBaseUseCase = new KnowledgeBaseUseCase(
  new JsonKnowledgeRepository(),
  new Utf8KnowledgeSourceReader(),
  new OpenAIEmbeddingClient(),
  new SettingsKnowledgeConfigProvider(),
);
