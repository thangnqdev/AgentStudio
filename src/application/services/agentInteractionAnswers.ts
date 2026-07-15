import type { AgentInteractionAnnotation, AgentQuestion } from '../../domain/entities/agentInteraction';

export type QuestionDraftState = {
  selections: Record<number, string[]>;
  otherValues: Record<number, string>;
  notes: Record<number, string>;
};

export function buildAgentQuestionResponse(questions: AgentQuestion[], draft: QuestionDraftState) {
  const answers: Record<string, string> = {};
  const annotations: Record<string, AgentInteractionAnnotation> = {};
  questions.forEach((question, index) => {
    const selected = draft.selections[index] ?? [];
    const other = (draft.otherValues[index] ?? '').trim();
    const values = [...selected, ...(other ? [other] : [])];
    if (values.length === 0) throw new Error(`Missing answer for question ${index + 1}.`);
    if (!question.multiSelect && values.length !== 1) throw new Error(`Question ${index + 1} accepts one answer.`);
    const answer = values.join(', ');
    if (answer.length > 2_000) throw new Error(`Answer ${index + 1} is too long.`);
    answers[question.question] = answer;
    const preview = question.options.find((option) => selected.includes(option.label))?.preview;
    const note = (draft.notes[index] ?? '').trim();
    if (preview || note) annotations[question.question] = { ...(preview ? { preview } : {}), ...(note ? { notes: note } : {}) };
  });
  return { answers, ...(Object.keys(annotations).length ? { annotations } : {}) };
}
