const MAX_RETRIEVAL_CONTEXT_CHARS = 1_200;

export function buildKnowledgeQuery(question: string, previousUserMessages: string[]) {
  const currentQuestion = question.trim();
  if (!currentQuestion) return '';
  const history = previousUserMessages
    .slice(-2)
    .map((message) => message.trim())
    .filter(Boolean)
    .join('\n');
  if (!history) return currentQuestion;
  const availableHistoryChars = Math.max(0, MAX_RETRIEVAL_CONTEXT_CHARS - currentQuestion.length - 1);
  return `${history.slice(-availableHistoryChars)}\n${currentQuestion}`.trim();
}
