import { describe, expect, it } from 'vitest';
import { KnowledgeIndexQueue } from './knowledgeIndexQueue.js';

describe('KnowledgeIndexQueue', () => {
  it('serializes asynchronous index updates', async () => {
    const queue = new KnowledgeIndexQueue();
    const events: string[] = [];
    const first = queue.enqueue(async () => { events.push('first-start'); await Promise.resolve(); events.push('first-end'); });
    const second = queue.enqueue(async () => { events.push('second'); });

    await Promise.all([first, second]);
    expect(events).toEqual(['first-start', 'first-end', 'second']);
  });
});
