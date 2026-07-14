import { describe, expect, it } from 'vitest';
import { createAgentRunState, transitionAgentRun } from './agentRunState.js';

describe('agent run state', () => {
  it('advances one tool step through model, tools and checkpoint phases', () => {
    let state = createAgentRunState(4);
    state = transitionAgentRun(state, { type: 'request_model' });
    state = transitionAgentRun(state, { type: 'model_response', hasToolCalls: true });
    state = transitionAgentRun(state, { type: 'tools_completed' });
    expect(state).toMatchObject({ phase: 'checkpointing', completedSteps: 5 });
    expect(transitionAgentRun(state, { type: 'checkpoint_saved' })).toMatchObject({ phase: 'ready', completedSteps: 5 });
  });

  it('completes directly when the model returns no tools', () => {
    const requesting = transitionAgentRun(createAgentRunState(), { type: 'request_model' });
    expect(transitionAgentRun(requesting, { type: 'model_response', hasToolCalls: false })).toEqual({
      phase: 'completed', completedSteps: 0, terminalReason: 'completed',
    });
  });

  it('returns to ready when a bounded output continuation is required', () => {
    const requesting = transitionAgentRun(createAgentRunState(2), { type: 'request_model' });
    expect(transitionAgentRun(requesting, { type: 'model_response', hasToolCalls: false, requiresContinuation: true }))
      .toMatchObject({ phase: 'ready', completedSteps: 2 });
  });

  it('rejects invalid phase transitions', () => {
    expect(() => transitionAgentRun(createAgentRunState(), { type: 'tools_completed' })).toThrow('Cannot apply');
  });
});
