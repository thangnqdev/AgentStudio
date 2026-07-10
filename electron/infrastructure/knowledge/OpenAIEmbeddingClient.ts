import type { KnowledgeEmbeddingConfig } from '../../domain/entities/knowledge.js';
import type { IKnowledgeEmbedder } from '../../domain/ports/IKnowledgeEmbedder.js';

export class OpenAIEmbeddingClient implements IKnowledgeEmbedder {
  async embed(input: string[], config: KnowledgeEmbeddingConfig) {
    const endpoint = new URL('embeddings', `${config.baseUrl.replace(/\/$/, '')}/`).toString();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, input, encoding_format: 'float' }),
    });
    if (!response.ok) throw new Error('Embedding endpoint is unavailable.');
    const payload = await response.json() as { data?: Array<{ embedding?: unknown }> };
    const embeddings = (payload.data ?? []).map((item) => Array.isArray(item.embedding)
      ? item.embedding.filter((value): value is number => typeof value === 'number')
      : []);
    if (embeddings.length !== input.length || embeddings.some((embedding) => embedding.length === 0)) {
      throw new Error('Embedding response is invalid.');
    }
    return embeddings;
  }
}
