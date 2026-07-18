import type {
  AgentAmbientContextRequest,
  IAgentAmbientContextSource,
} from '../../domain/ports/IAgentAmbientContextSource.js';

export class CompositeAgentAmbientContextSource implements IAgentAmbientContextSource {
  private readonly sources: readonly IAgentAmbientContextSource[];

  constructor(sources: readonly IAgentAmbientContextSource[]) {
    this.sources = sources;
  }

  async drain(workspaceRoot: string, request: AgentAmbientContextRequest) {
    const contexts = await Promise.all(this.sources.map((source) => source.drain(workspaceRoot, request)));
    return contexts.filter(Boolean).join('\n\n');
  }
}
