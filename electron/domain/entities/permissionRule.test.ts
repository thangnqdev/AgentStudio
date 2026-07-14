import { describe, expect, it } from 'vitest';
import { evaluateToolPermission, matchesPermissionGlob, normalizePermissionRules, type PermissionRule } from './permissionRule.js';
import type { AgentToolDefinition, ToolRisk } from './tool.js';

describe('permission rules', () => {
  it('gives deny precedence even in danger-full-access mode', () => {
    const decision = evaluateToolPermission(tool('run_command', 'execute'), 'danger-full-access', { command: 'rm -rf build' }, [
      rule('allow-command', 'allow', 'user', 'run_*'),
      { ...rule('deny-delete', 'deny', 'workspace', 'run_command'), commandPrefix: 'rm ' },
    ]);
    expect(decision).toMatchObject({ allowed: false, requiresApproval: false, matchedRule: { id: 'deny-delete', effect: 'deny' } });
  });

  it('lets an explicit user allow bypass workspace-write approval', () => {
    const decision = evaluateToolPermission(tool('write_file', 'write'), 'workspace-write', { path: './docs/readme.md' }, [
      { ...rule('allow-docs', 'allow', 'user', 'write_file'), pathGlob: 'docs/*' },
    ]);
    expect(decision).toMatchObject({ allowed: true, requiresApproval: false, matchedRule: { id: 'allow-docs' } });
  });

  it('gives ask precedence over allow and restores approval in danger mode', () => {
    const decision = evaluateToolPermission(tool('read_file', 'read'), 'danger-full-access', { path: 'config/secrets.json' }, [
      rule('allow-reads', 'allow', 'user', 'read_*'),
      { ...rule('ask-config', 'ask', 'workspace', 'read_file'), pathGlob: 'config\\*' },
    ]);
    expect(decision).toMatchObject({ allowed: true, requiresApproval: true, matchedRule: { id: 'ask-config', effect: 'ask' } });
  });

  it('does not let an allow rule weaken read-only mode', () => {
    expect(evaluateToolPermission(tool('write_file', 'write'), 'read-only', { path: 'notes.md' }, [
      rule('allow-write', 'allow', 'user', '*'),
    ]).allowed).toBe(false);
  });

  it('supports bounded wildcard matching without regular expressions', () => {
    expect(matchesPermissionGlob('mcp_*_read?', 'mcp_docs_read1')).toBe(true);
    expect(matchesPermissionGlob('mcp_*_read?', 'mcp_docs_write1')).toBe(false);
  });

  it('rejects workspace allow rules and malformed input', () => {
    expect(() => normalizePermissionRules([{ effect: 'allow', toolGlob: '*' }], 'workspace', ['deny', 'ask'])).toThrow('invalid effect');
    expect(() => normalizePermissionRules({ rules: [{ effect: 'deny' }] }, 'workspace', ['deny', 'ask'])).toThrow('requires toolGlob');
  });
});

function rule(id: string, effect: PermissionRule['effect'], source: PermissionRule['source'], toolGlob: string): PermissionRule {
  return { id, effect, source, toolGlob };
}

function tool(name: string, risk: ToolRisk): AgentToolDefinition {
  return { name, risk, description: '', parameters: {} };
}
