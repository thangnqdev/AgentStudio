import { describe, expect, it } from 'vitest';
import { assertDeleteAgentTeamInput, parseCreateAgentTeamInput } from './agentTeamInput.js';

describe('agentTeamInput', () => {
  it('accepts a bounded human-readable team name like the reference client', () => {
    expect(parseCreateAgentTeamInput({
      team_name: 'Architecture Review / July', description: 'Review boundaries', agent_type: 'lead reviewer',
    })).toEqual({ teamName: 'Architecture Review / July', description: 'Review boundaries', agentType: 'lead reviewer' });
  });

  it('rejects empty, oversized, null-byte, and unknown fields', () => {
    expect(() => parseCreateAgentTeamInput({ team_name: ' ' })).toThrow('required');
    expect(() => parseCreateAgentTeamInput({ team_name: 'x'.repeat(65) })).toThrow('required');
    expect(() => parseCreateAgentTeamInput({ team_name: 'team\0name' })).toThrow('required');
    expect(() => parseCreateAgentTeamInput({ team_name: 'team', extra: true })).toThrow('Unexpected');
    expect(() => assertDeleteAgentTeamInput({ extra: true })).toThrow('Unexpected');
  });
});
