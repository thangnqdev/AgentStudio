/**
 * Hằng số và hàm tính ngân sách token dùng chung cho cả RunAgentSession (use-case)
 * và OpenAIProvider (infrastructure). Đặt trong domain vì đây là quy tắc nghiệp vụ
 * thuần tuý, không phụ thuộc framework nào.
 */

export const MAX_RESPONSE_TOKENS = 8_192;
const DEFAULT_INPUT_CONTEXT_TOKENS = 24_000;

/**
 * Trả về true nếu `value` là context window hợp lệ (≥ 2048 token).
 */
export function isUsableContextWindow(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 2_048;
}

/**
 * Số token tối đa dành cho phần phản hồi của model.
 */
export function getResponseTokenLimit(contextWindow: number | undefined): number {
  if (!isUsableContextWindow(contextWindow)) return MAX_RESPONSE_TOKENS;
  return Math.min(MAX_RESPONSE_TOKENS, Math.max(1_024, Math.floor(contextWindow * 0.25)));
}

/**
 * Số token tối đa dành cho phần ngữ cảnh đầu vào (conversation history).
 * = contextWindow − responseTokens − overheadTokens
 */
export function getInputContextTokenBudget(contextWindow: number | undefined): number {
  if (!isUsableContextWindow(contextWindow)) return DEFAULT_INPUT_CONTEXT_TOKENS;
  const responseTokens = getResponseTokenLimit(contextWindow);
  const overheadTokens = Math.min(4_000, Math.max(800, Math.floor(contextWindow * 0.05)));
  return Math.max(1_000, contextWindow - responseTokens - overheadTokens);
}
