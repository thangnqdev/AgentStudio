import { AGENT_CONFIG_TOOL_NAME } from '../../domain/entities/agentConfig.js';
import type { IToolPermissionPolicy } from '../../domain/ports/IToolPermissionPolicy.js';

export class ConfigToolPermissionPolicy implements IToolPermissionPolicy {
  private readonly base: IToolPermissionPolicy;

  constructor(base: IToolPermissionPolicy) { this.base = base; }

  async evaluate(input: Parameters<IToolPermissionPolicy['evaluate']>[0]) {
    if (input.tool.name !== AGENT_CONFIG_TOOL_NAME) return this.base.evaluate(input);
    const mutation = Object.hasOwn(input.args, 'value');
    const decision = await this.base.evaluate({
      ...input,
      tool: mutation ? input.tool : { ...input.tool, risk: 'read', readOnly: true },
    });
    if (!decision.allowed || !mutation) return decision;
    return { ...decision, requiresApproval: true };
  }
}
