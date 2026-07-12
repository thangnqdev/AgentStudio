import { describe, expect, it } from 'vitest';
import { evaluateToolPolicy } from './tool.js';
import { getLocalToolDefinition } from '../../infrastructure/tools/localToolDefinitions.js';

describe('evaluateToolPolicy', () => {
  it('allows reads but requires approval for writes and commands', () => {
    expect(evaluateToolPolicy(getLocalToolDefinition('read_file'), 'read-only')).toEqual({ allowed: true, requiresApproval: false });
    expect(evaluateToolPolicy(getLocalToolDefinition('write_file'), 'read-only').allowed).toBe(false);
    expect(evaluateToolPolicy(getLocalToolDefinition('write_file'), 'workspace-write')).toEqual({ allowed: true, requiresApproval: true });
    expect(evaluateToolPolicy(getLocalToolDefinition('run_command'), 'danger-full-access')).toEqual({ allowed: true, requiresApproval: false });
  });

  it('requires approval and blocks web access in read-only mode', () => {
    expect(evaluateToolPolicy(getLocalToolDefinition('web_search'), 'read-only').allowed).toBe(false);
    expect(evaluateToolPolicy(getLocalToolDefinition('web_search'), 'workspace-write')).toEqual({ allowed: true, requiresApproval: true });
  });
});
