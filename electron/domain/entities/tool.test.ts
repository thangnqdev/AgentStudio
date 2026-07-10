import { describe, expect, it } from 'vitest';
import { evaluateToolPolicy, getAgentToolDefinition } from './tool.js';

describe('evaluateToolPolicy', () => {
  it('allows reads but requires approval for writes and commands', () => {
    expect(evaluateToolPolicy(getAgentToolDefinition('read_file'), 'read-only')).toEqual({ allowed: true, requiresApproval: false });
    expect(evaluateToolPolicy(getAgentToolDefinition('write_file'), 'read-only').allowed).toBe(false);
    expect(evaluateToolPolicy(getAgentToolDefinition('write_file'), 'workspace-write')).toEqual({ allowed: true, requiresApproval: true });
    expect(evaluateToolPolicy(getAgentToolDefinition('run_command'), 'danger-full-access')).toEqual({ allowed: true, requiresApproval: true });
  });
});
