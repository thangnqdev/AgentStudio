import { describe, expect, it } from 'vitest';
import { parseAskUserQuestionInput, parseEnterPlanModeInput, parseExitPlanModeInput } from './agentInteractionInput.js';

describe('agentInteractionInput', () => {
  const question = {
    question: 'Which approach should we use?', header: 'Approach', multiSelect: false,
    options: [
      { label: 'Adapter', description: 'Keep boundaries explicit.', preview: '**Adapter** preview' },
      { label: 'Direct', description: 'Use the dependency directly.' },
    ],
  };

  it('parses bounded structured questions and plan inputs', () => {
    expect(parseAskUserQuestionInput({ questions: [question] }).questions[0]).toEqual(question);
    expect(parseEnterPlanModeInput({})).toEqual({});
    expect(parseExitPlanModeInput({ plan: '# Plan', allowedPrompts: [{ tool: 'Bash', prompt: 'run tests' }] }))
      .toEqual({ plan: '# Plan', allowedPrompts: [{ tool: 'Bash', prompt: 'run tests' }] });
  });

  it('rejects duplicate questions, synthetic Other options, and unexpected properties', () => {
    expect(() => parseAskUserQuestionInput({ questions: [question, question] })).toThrow('unique');
    expect(() => parseAskUserQuestionInput({ questions: [{ ...question, options: [question.options[0], { label: 'Other', description: 'custom' }] }] })).toThrow('Other');
    expect(() => parseAskUserQuestionInput({ questions: [question], answers: {} })).toThrow('Unexpected');
  });

  it('requires a non-empty bounded plan and semantic Bash prompts only', () => {
    expect(() => parseExitPlanModeInput({ plan: ' ' })).toThrow('non-empty');
    expect(() => parseExitPlanModeInput({ plan: '# Plan', allowedPrompts: [{ tool: 'Write', prompt: 'edit files' }] })).toThrow('Bash');
  });
});
