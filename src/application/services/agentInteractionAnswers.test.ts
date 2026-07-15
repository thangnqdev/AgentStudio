import { describe, expect, it } from 'vitest';
import { buildAgentQuestionResponse } from './agentInteractionAnswers';

const questions = [{
  question: 'Which features?', header: 'Features', multiSelect: true,
  options: [
    { label: 'Tests', description: 'Add tests.', preview: '**Test preview**' },
    { label: 'Docs', description: 'Add docs.' },
  ],
}];

describe('buildAgentQuestionResponse', () => {
  it('combines multi-select, Other, preview, and notes deterministically', () => {
    expect(buildAgentQuestionResponse(questions, {
      selections: { 0: ['Tests'] }, otherValues: { 0: 'Telemetry' }, notes: { 0: 'Keep it local.' },
    })).toEqual({
      answers: { 'Which features?': 'Tests, Telemetry' },
      annotations: { 'Which features?': { preview: '**Test preview**', notes: 'Keep it local.' } },
    });
  });

  it('requires every question to have an answer', () => {
    expect(() => buildAgentQuestionResponse(questions, { selections: {}, otherValues: {}, notes: {} })).toThrow('Missing');
  });
});
