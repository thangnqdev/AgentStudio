import { describe, expect, it } from 'vitest';
import { readAssistantContent } from './assistantMessage.js';

describe('readAssistantContent', () => {
  it('normalizes text and multipart assistant content', () => {
    expect(readAssistantContent({ role: 'assistant', content: 'plain' })).toBe('plain');
    expect(readAssistantContent({ role: 'assistant', content: [{ text: 'part ' }, { ignored: true }, { text: 'two' }] })).toBe('part two');
    expect(readAssistantContent({ role: 'assistant', content: null })).toBe('');
  });
});
