export const MAX_OUTPUT_CONTINUATIONS = 3;

export const OUTPUT_CONTINUATION_PROMPT = [
  'Continue directly from the previous response.',
  'Do not repeat earlier content or add a new introduction.',
  'If the task is already complete, finish with a concise final result.',
].join(' ');

export function shouldContinueModelOutput(finishReason: string | undefined, completedContinuations: number) {
  return finishReason === 'length'
    && Number.isInteger(completedContinuations)
    && completedContinuations >= 0
    && completedContinuations < MAX_OUTPUT_CONTINUATIONS;
}
