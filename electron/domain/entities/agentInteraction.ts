export type AgentQuestionOption = {
  label: string;
  description: string;
  preview?: string;
};

export type AgentQuestion = {
  question: string;
  header: string;
  options: AgentQuestionOption[];
  multiSelect: boolean;
};

export type AgentInteractionAnnotation = {
  preview?: string;
  notes?: string;
};

export type AgentInteractionRequest = {
  id: string;
  kind: 'questions' | 'plan_enter' | 'plan_exit';
  title: string;
  questions?: AgentQuestion[];
  plan?: string;
};

export type AgentInteractionResponse = {
  accepted: boolean;
  answers?: Record<string, string>;
  annotations?: Record<string, AgentInteractionAnnotation>;
};
