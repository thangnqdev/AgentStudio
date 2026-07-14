import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../domain/entities/agent.js';
import { contextProjectionPolicy, projectConversationForModel } from './conversationProjection.js';

function tool(id: string, content: string): ChatMessage {
  return { role: 'tool', tool_call_id: id, content };
}

describe('conversation projection', () => {
  it('omits old tool results while protecting recent results and source history', () => {
    const source = [tool('old-1', 'a'.repeat(100)), tool('old-2', 'b'.repeat(100)), tool('recent', 'c'.repeat(100))];
    const result = projectConversationForModel(source, {
      maximumToolResultCharacters: 1_000,
      totalToolResultBudgetCharacters: 150,
      protectedRecentToolResults: 1,
    });
    expect(result.omittedToolResults).toBe(2);
    expect(result.messages[0].content).toContain('tool_call_id=old-1');
    expect(result.messages[2].content).toBe('c'.repeat(100));
    expect(source[0].content).toBe('a'.repeat(100));
  });

  it('bounds individual results even when they are protected', () => {
    const result = projectConversationForModel([tool('recent', 'x'.repeat(1_000))], {
      maximumToolResultCharacters: 100,
      totalToolResultBudgetCharacters: 10_000,
      protectedRecentToolResults: 1,
    });
    expect(result.truncatedToolResults).toBe(1);
    expect(String(result.messages[0].content)).toContain('tool result truncated');
  });

  it('derives a bounded policy from the input token budget', () => {
    expect(contextProjectionPolicy(24_000)).toEqual({
      maximumToolResultCharacters: 11_520,
      totalToolResultBudgetCharacters: 21_120,
      protectedRecentToolResults: 4,
    });
  });
});
