import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { CapabilityDescriptor } from '../../domain/entities/capability.js';
import type { SkillStatus } from '../../domain/entities/skill.js';
import type { ICapabilitySource } from '../../domain/ports/ICapabilitySource.js';

type Loaders = { tools: () => Promise<AgentToolDefinition[]>; skills: () => Promise<SkillStatus[]>; knowledgeAvailable: () => Promise<boolean>; terminalAvailable: () => Promise<boolean> };
const LOCAL_ZERO = { value: 0, unit: 'usd_per_call' as const, confidence: 'local-zero' as const };
const UNKNOWN = { value: null, unit: 'usd_per_call' as const, confidence: 'unknown' as const };

export class LocalPlatformCapabilitySource implements ICapabilitySource {
  private readonly loaders: Loaders;

  constructor(loaders: Loaders) {
    this.loaders = loaders;
  }
  async list(): Promise<CapabilityDescriptor[]> {
    const [tools, skills, knowledgeAvailable, terminalAvailable] = await Promise.all([this.loaders.tools(), this.loaders.skills(), this.loaders.knowledgeAvailable(), this.loaders.terminalAvailable()]);
    return [
      ...tools.map((tool): CapabilityDescriptor => ({
        id: `tool:${tool.name}`, name: tool.name, description: tool.description,
        kind: tool.source?.kind === 'mcp' ? 'mcp_tool' : tool.name === 'web_search' ? 'web_search' : 'local_tool',
        risk: tool.risk, available: true, costEstimate: tool.source?.kind === 'mcp' || tool.name === 'web_search' ? UNKNOWN : LOCAL_ZERO,
        sourceId: tool.source?.kind === 'mcp' ? `mcp:${tool.source.serverId}` : 'local-tools',
      })),
      { id: 'knowledge:retrieval', name: 'Knowledge retrieval', description: 'Hybrid local knowledge-base retrieval.', kind: 'knowledge_retrieval', risk: 'network', available: knowledgeAvailable, costEstimate: UNKNOWN, sourceId: 'knowledge-base' },
      ...skills.map((skill): CapabilityDescriptor => ({ id: `skill:${skill.id}`, name: skill.name, description: skill.description, kind: 'skill', risk: 'read', available: skill.enabled && skill.trusted, costEstimate: LOCAL_ZERO, sourceId: `skill:${skill.origin}` })),
      { id: 'terminal:pty', name: 'PTY terminal', description: 'Interactive local terminal session.', kind: 'terminal', risk: 'execute', available: terminalAvailable, costEstimate: LOCAL_ZERO, sourceId: 'local-terminal' },
    ];
  }
}
