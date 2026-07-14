import type { PermissionRule } from '../../domain/entities/permissionRule.js';
import type { ILifecycleHookSource } from '../../domain/ports/ILifecycleHookSource.js';
import type { IPermissionRuleSource } from '../../domain/ports/IPermissionRuleSource.js';

export class LifecycleHookPermissionRuleSource implements IPermissionRuleSource {
  private readonly hooks: ILifecycleHookSource;

  constructor(hooks: ILifecycleHookSource) {
    this.hooks = hooks;
  }

  async list(workspaceRoot: string) {
    const definitions = await this.hooks.list(workspaceRoot);
    return definitions.flatMap((definition): PermissionRule[] => {
      if (definition.event !== 'PreToolUse') return [];
      return definition.actions.flatMap((action, index): PermissionRule[] => {
        if (action.type !== 'deny_tool' && action.type !== 'require_approval') return [];
        return [{
          id: `hook:${definition.id}:${index + 1}`,
          effect: action.type === 'deny_tool' ? 'deny' : 'ask',
          source: 'workspace',
          toolGlob: definition.matcher ?? '*',
        }];
      });
    });
  }
}
