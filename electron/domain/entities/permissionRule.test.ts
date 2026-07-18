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

  it('canonicalizes equivalent workspace paths before matching rules', () => {
    const decision = evaluateToolPermission(tool('read_file', 'read'), 'danger-full-access', { path: 'src/../config/secret.json' }, [
      { ...rule('deny-config', 'deny', 'user', 'read_file'), pathGlob: 'config/*' },
    ]);
    expect(decision).toMatchObject({ allowed: false, matchedRule: { id: 'deny-config' } });
  });

  it('matches command prefixes across shell segments and executable paths', () => {
    for (const command of ['cd . && rm -rf important', '/bin/rm -rf important', 'env MODE=test rm -rf important']) {
      const decision = evaluateToolPermission(tool('run_command', 'execute'), 'danger-full-access', { command }, [
        { ...rule('deny-delete', 'deny', 'user', 'run_command'), commandPrefix: 'rm' },
      ]);
      expect(decision, command).toMatchObject({ allowed: false, matchedRule: { id: 'deny-delete' } });
    }
  });

  it('fails closed for deny and ask rules when shell execution is ambiguous', () => {
    const rules: PermissionRule[] = [{ ...rule('deny-delete', 'deny', 'user', 'run_command'), commandPrefix: 'rm' }];
    expect(evaluateToolPermission(tool('run_command', 'execute'), 'danger-full-access', { command: 'sh -c "rm -rf important"' }, rules).allowed).toBe(false);
    expect(evaluateToolPermission(tool('run_command', 'execute'), 'danger-full-access', { command: 'echo $(rm -rf important)' }, rules).allowed).toBe(false);
  });

  it('applies read_file path restrictions to broad glob and grep searches', () => {
    const rules: PermissionRule[] = [{ ...rule('deny-config', 'deny', 'user', 'read_file'), pathGlob: 'config/*' }];
    expect(evaluateToolPermission(tool('glob', 'read'), 'workspace-write', { pattern: '**/*' }, rules).allowed).toBe(false);
    expect(evaluateToolPermission(tool('grep', 'read'), 'workspace-write', { pattern: 'secret' }, rules).allowed).toBe(false);
    expect(evaluateToolPermission(tool('glob', 'read'), 'workspace-write', { pattern: 'src/**/*.ts' }, rules).allowed).toBe(true);
  });

  it('applies canonical rules and path constraints to compatibility aliases', () => {
    expect(evaluateToolPermission(tool('Bash', 'execute'), 'danger-full-access', { command: 'rm item' }, [
      { ...rule('deny-shell', 'deny', 'user', 'run_command'), commandPrefix: 'rm' },
    ])).toMatchObject({ allowed: false, matchedRule: { id: 'deny-shell' } });
    expect(evaluateToolPermission(tool('Read', 'read'), 'danger-full-access', { file_path: 'config/secret.json' }, [
      { ...rule('ask-config', 'ask', 'user', 'read_file'), pathGlob: 'config/*' },
    ])).toMatchObject({ allowed: true, requiresApproval: true, matchedRule: { id: 'ask-config' } });
    expect(evaluateToolPermission(tool('KillShell', 'execute'), 'danger-full-access', { shell_id: 'bg-1' }, [
      rule('deny-stop', 'deny', 'user', 'TaskStop'),
    ])).toMatchObject({ allowed: false, matchedRule: { id: 'deny-stop' } });
  });

  it('scopes network rules to normalized URL hostnames', () => {
    const webFetch = { ...tool('WebFetch', 'network'), readOnly: true };
    const rules: PermissionRule[] = [
      { ...rule('allow-example', 'allow', 'user', 'WebFetch'), domainGlob: '*.example.com' },
    ];
    expect(evaluateToolPermission(webFetch, 'workspace-write', { url: 'https://DOCS.EXAMPLE.com/page' }, rules))
      .toMatchObject({ allowed: true, requiresApproval: false, matchedRule: { id: 'allow-example' } });
    expect(evaluateToolPermission(webFetch, 'workspace-write', { url: 'https://example.net/page' }, rules))
      .toMatchObject({ allowed: true, requiresApproval: true });
  });

  it('normalizes bounded domain constraints from persisted rules', () => {
    expect(normalizePermissionRules([
      { effect: 'ask', toolGlob: 'WebFetch', domainGlob: '*.example.com' },
    ], 'workspace', ['deny', 'ask'])[0]).toMatchObject({ domainGlob: '*.example.com' });
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
