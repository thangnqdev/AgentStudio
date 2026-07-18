import { describe, expect, it, vi } from 'vitest';
import type { AgentInteractionRequest, AgentInteractionResponse } from '../../domain/entities/agentInteraction.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import { ManageAgentPlanMode } from '../usecases/ManageAgentPlanMode.js';
import { InteractiveToolPlatform } from './InteractiveToolPlatform.js';

const question = {
  question: 'Which architecture should we use?', header: 'Approach', multiSelect: false,
  options: [
    { label: 'Ports', description: 'Use explicit ports.' },
    { label: 'Direct', description: 'Call infrastructure directly.' },
  ],
};

describe('InteractiveToolPlatform', () => {
  it('runs question and plan interactions with scoped state and approved-plan persistence', async () => {
    const emitted: AgentInteractionRequest[] = [];
    const planModeEvents: boolean[] = [];
    const responses: AgentInteractionResponse[] = [
      {
        accepted: true,
        answers: { [question.question]: 'Ports' },
        annotations: { [question.question]: { preview: 'Adapter sketch', notes: 'Keep domain pure.' } },
      },
      { accepted: true },
      { accepted: true },
    ];
    const save = vi.fn(async () => ({ reference: 'plan-private.md' }));
    const hookDispatch = vi.fn(async (_input: { event: string; workspaceRoot: string; matchValue?: string }) => (
      { matchedHookIds: [], contexts: [], auditLabels: [] }
    ));
    const plans = new ManageAgentPlanMode({ save });
    const platform = new InteractiveToolPlatform(
      { list: async () => [] },
      { execute: vi.fn(async () => ({ ok: true, output: 'base' })) },
      plans,
      { waitForResponse: async () => responses.shift() ?? { accepted: false } },
      eventSink(emitted, planModeEvents),
      { scopeId: 'chat-a', requestId: 'request-a' },
      () => `interaction-${emitted.length + 1}`,
      { dispatch: hookDispatch },
    );

    const answer = await platform.execute('AskUserQuestion', { questions: [question] }, '/workspace', 'read-only');
    expect(answer).toMatchObject({ ok: true });
    expect(answer.output).toContain('Ports');
    expect(answer.output).toContain('Adapter sketch');
    expect(answer.output).toContain('Keep domain pure.');
    const entered = await platform.execute('EnterPlanMode', {}, '/workspace', 'danger-full-access');
    expect(entered.output).toContain('read-only');
    expect(plans.isActive('chat-a')).toBe(true);
    const exited = await platform.execute('ExitPlanMode', { plan: '# Implement through ports' }, '/workspace', 'danger-full-access');
    expect(exited.output).toContain('## Approved Plan');
    expect(plans.isActive('chat-a')).toBe(false);
    expect(save).toHaveBeenCalledWith('chat-a', '# Implement through ports');
    expect(emitted.map((item) => item.kind)).toEqual(['questions', 'plan_enter', 'plan_exit']);
    expect(planModeEvents).toEqual([true, false]);
    expect(hookDispatch.mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({ event: 'Elicitation', workspaceRoot: '/workspace', matchValue: 'questions' }),
      expect.objectContaining({ event: 'ElicitationResult', workspaceRoot: '/workspace', matchValue: 'questions' }),
    ]);
  });

  it('keeps plan mode active when the user requests plan changes', async () => {
    const plans = new ManageAgentPlanMode({ save: async () => ({ reference: 'unused' }) });
    plans.enter('chat-a');
    const platform = new InteractiveToolPlatform(
      { list: async () => [] }, { execute: async () => ({ ok: true, output: 'base' }) }, plans,
      { waitForResponse: async () => ({ accepted: false }) }, eventSink([]),
      { scopeId: 'chat-a', requestId: 'request-a' }, () => 'interaction-reject',
    );
    const result = await platform.execute('ExitPlanMode', { plan: '# Revise me' }, '/workspace', 'danger-full-access');
    expect(result).toMatchObject({ ok: false });
    expect(plans.isActive('chat-a')).toBe(true);
  });

  it('publishes the three deferred tool contracts without replacing base tools', async () => {
    const platform = new InteractiveToolPlatform(
      { list: async () => [{ name: 'read_file', description: 'read', risk: 'read', parameters: {} }] },
      { execute: async () => ({ ok: true, output: '' }) },
      new ManageAgentPlanMode({ save: async () => ({ reference: 'plan' }) }),
      { waitForResponse: async () => ({ accepted: false }) }, eventSink([]),
      { scopeId: 'chat-a', requestId: 'request-a' },
    );
    expect((await platform.list('/workspace')).map((tool) => tool.name)).toEqual([
      'read_file', 'AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode',
    ]);
  });
});

function eventSink(emitted: AgentInteractionRequest[], planModeEvents: boolean[] = []): IAgentEventSink {
  return {
    emitChunk: () => undefined,
    emitAction: () => undefined,
    emitDone: () => undefined,
    emitError: () => undefined,
    emitInteraction: (_requestId, interaction) => { emitted.push(interaction); },
    emitPlanMode: (_requestId, planMode) => { planModeEvents.push(planMode.active); },
  };
}
