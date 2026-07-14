import { evaluateToolPermission } from '../../domain/entities/permissionRule.js';
import type { IPermissionRuleSource } from '../../domain/ports/IPermissionRuleSource.js';
import type { IToolPermissionPolicy } from '../../domain/ports/IToolPermissionPolicy.js';

export class ToolPermissionPolicy implements IToolPermissionPolicy {
  private readonly sources: readonly IPermissionRuleSource[];

  constructor(sources: readonly IPermissionRuleSource[]) {
    this.sources = sources;
  }

  async evaluate(input: Parameters<IToolPermissionPolicy['evaluate']>[0]) {
    const ruleGroups = await Promise.all(this.sources.map((source) => source.list(input.workspaceRoot)));
    return evaluateToolPermission(input.tool, input.permissionMode, input.args, ruleGroups.flat());
  }
}
