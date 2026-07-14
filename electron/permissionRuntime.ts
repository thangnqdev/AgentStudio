import path from 'node:path';
import { app } from 'electron';
import { ToolPermissionPolicy } from './application/services/ToolPermissionPolicy.js';
import { FilePermissionRuleSource } from './infrastructure/permissions/FilePermissionRuleSource.js';
import { resolveSafeWorkspacePath } from './infrastructure/security/resolveSafePath.js';
import { lifecycleHookPermissionRuleSource } from './hookRuntime.js';

const workspaceRules = new FilePermissionRuleSource({
  source: 'workspace',
  allowedEffects: ['deny', 'ask'],
  resolvePath: (workspaceRoot) => resolveSafeWorkspacePath('.agentstudio/permissions.json', workspaceRoot, { allowMissingFinalPath: true }),
});

const userRules = new FilePermissionRuleSource({
  source: 'user',
  allowedEffects: ['allow', 'ask', 'deny'],
  resolvePath: () => path.join(app.getPath('userData'), 'permissions', 'rules.json'),
});

export const toolPermissionPolicy = new ToolPermissionPolicy([workspaceRules, lifecycleHookPermissionRuleSource, userRules]);
