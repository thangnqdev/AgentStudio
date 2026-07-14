export type AgentRunPhase =
  | 'ready'
  | 'requesting_model'
  | 'executing_tools'
  | 'checkpointing'
  | 'completed'
  | 'paused'
  | 'failed'
  | 'stopped';

export type AgentRunState = {
  phase: AgentRunPhase;
  completedSteps: number;
  terminalReason?: 'completed' | 'run_step_limit' | 'task_step_limit' | 'failed' | 'stopped';
};

export type AgentRunEvent =
  | { type: 'request_model' }
  | { type: 'model_response'; hasToolCalls: boolean; requiresContinuation?: boolean }
  | { type: 'tools_completed' }
  | { type: 'checkpoint_saved' }
  | { type: 'pause'; reason: 'run_step_limit' | 'task_step_limit' }
  | { type: 'fail' }
  | { type: 'stop' };

export function createAgentRunState(completedSteps = 0): AgentRunState {
  if (!Number.isInteger(completedSteps) || completedSteps < 0) throw new Error('completedSteps must be a non-negative integer.');
  return { phase: 'ready', completedSteps };
}

export function transitionAgentRun(state: AgentRunState, event: AgentRunEvent): AgentRunState {
  if (event.type === 'fail') return terminal(state, 'failed', 'failed');
  if (event.type === 'stop') return terminal(state, 'stopped', 'stopped');

  if (event.type === 'request_model') {
    requirePhase(state, 'ready', event.type);
    return { ...state, phase: 'requesting_model' };
  }
  if (event.type === 'model_response') {
    requirePhase(state, 'requesting_model', event.type);
    return event.hasToolCalls
      ? { ...state, phase: 'executing_tools' }
      : event.requiresContinuation
        ? { ...state, phase: 'ready' }
      : { ...state, phase: 'completed', terminalReason: 'completed' };
  }
  if (event.type === 'tools_completed') {
    requirePhase(state, 'executing_tools', event.type);
    return { ...state, phase: 'checkpointing', completedSteps: state.completedSteps + 1 };
  }
  if (event.type === 'checkpoint_saved') {
    requirePhase(state, 'checkpointing', event.type);
    return { ...state, phase: 'ready' };
  }
  requirePhase(state, 'ready', event.type);
  return { ...state, phase: 'paused', terminalReason: event.reason };
}

function requirePhase(state: AgentRunState, expected: AgentRunPhase, event: AgentRunEvent['type']) {
  if (state.phase !== expected) throw new Error(`Cannot apply ${event} while agent run is ${state.phase}.`);
}

function terminal(state: AgentRunState, phase: 'failed' | 'stopped', terminalReason: 'failed' | 'stopped') {
  if (['completed', 'paused', 'failed', 'stopped'].includes(state.phase)) {
    throw new Error(`Cannot transition terminal agent run from ${state.phase}.`);
  }
  return { ...state, phase, terminalReason };
}
