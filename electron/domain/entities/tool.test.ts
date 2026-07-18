import { describe, expect, it } from 'vitest';
import { evaluateToolPolicy, type AgentToolDefinition, type ToolRisk } from './tool.js';

describe('evaluateToolPolicy', () => {
  it('allows reads but requires approval for writes and commands', () => {
    expect(evaluateToolPolicy(tool('read_file', 'read'), 'read-only')).toEqual({ allowed: true, requiresApproval: false });
    expect(evaluateToolPolicy(tool('write_file', 'write'), 'read-only').allowed).toBe(false);
    expect(evaluateToolPolicy(tool('write_file', 'write'), 'workspace-write')).toEqual({ allowed: true, requiresApproval: true });
    expect(evaluateToolPolicy(tool('run_command', 'execute'), 'danger-full-access')).toEqual({ allowed: true, requiresApproval: false });
  });

  it('requires approval and blocks web access in read-only mode', () => {
    expect(evaluateToolPolicy(tool('web_search', 'network'), 'read-only').allowed).toBe(false);
    expect(evaluateToolPolicy(tool('web_search', 'network'), 'workspace-write')).toEqual({ allowed: true, requiresApproval: true });
  });

  it('permits explicitly read-only network tools while retaining network approval', () => {
    expect(evaluateToolPolicy({ ...tool('WebFetch', 'network'), readOnly: true }, 'read-only'))
      .toEqual({ allowed: true, requiresApproval: true });
  });
});

function tool(name: string, risk: ToolRisk): AgentToolDefinition {
  return { name, risk, description: '', parameters: {} };
}
