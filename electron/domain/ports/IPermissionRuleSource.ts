import type { PermissionRule } from '../entities/permissionRule.js';

export interface IPermissionRuleSource {
  list(workspaceRoot: string): Promise<PermissionRule[]>;
}
