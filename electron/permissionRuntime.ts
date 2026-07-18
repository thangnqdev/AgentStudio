import path from 'node:path';
import { app } from 'electron';
import { ToolPermissionPolicy } from './application/services/ToolPermissionPolicy.js';
import { FilePermissionRuleSource } from './infrastructure/permissions/FilePermissionRuleSource.js';
import { resolveSafeWorkspacePath } from './infrastructure/security/resolveSafePath.js';
import { lifecycleHookPermissionRuleSource } from './hookRuntime.js';
import { WebFetchPermissionPolicy } from './application/services/WebFetchPermissionPolicy.js';
import { FileUserPermissionRuleWriter } from './infrastructure/permissions/FileUserPermissionRuleWriter.js';
import { ConfigToolPermissionPolicy } from './application/services/ConfigToolPermissionPolicy.js';

const userRulePath = () => path.join(app.getPath('userData'), 'permissions', 'rules.json');

const workspaceRules = new FilePermissionRuleSource({
  source: 'workspace',
  allowedEffects: ['deny', 'ask'],
  resolvePath: (workspaceRoot) => resolveSafeWorkspacePath('.agentstudio/permissions.json', workspaceRoot, { allowMissingFinalPath: true }),
});

const userRules = new FilePermissionRuleSource({
  source: 'user',
  allowedEffects: ['allow', 'ask', 'deny'],
  resolvePath: userRulePath,
});

export const userPermissionRuleWriter = new FileUserPermissionRuleWriter(userRulePath);

export const toolPermissionPolicy = new ConfigToolPermissionPolicy(
  new WebFetchPermissionPolicy(
    new ToolPermissionPolicy([workspaceRules, lifecycleHookPermissionRuleSource, userRules]),
  ),
);
