import { describe, expect, it } from 'vitest';
import { assertAgentWorkItemGraph, createEmptyAgentWorkItemBoard, parseAgentWorkItemBoard, type AgentWorkItem } from './agentWorkItem.js';

const timestamp = '2026-07-15T00:00:00.000Z';

function item(id: string, blocks: string[] = [], blockedBy: string[] = []): AgentWorkItem {
  return { id, subject: `Task ${id}`, description: '', status: 'pending', blocks, blockedBy, createdAt: timestamp, updatedAt: timestamp };
}

describe('agent work-item domain', () => {
  it('normalizes a valid persistent board', () => {
    expect(parseAgentWorkItemBoard({ version: 1, nextId: 2, items: [item('1')] })).toEqual({
      version: 1, nextId: 2, items: [item('1')],
    });
    expect(createEmptyAgentWorkItemBoard()).toEqual({ version: 1, nextId: 1, items: [] });
  });

  it('rejects inconsistent, cyclic, and self-referencing dependency graphs', () => {
    expect(() => assertAgentWorkItemGraph([item('1', ['2']), item('2')])).toThrow('inconsistent');
    expect(() => assertAgentWorkItemGraph([item('1', ['2'], ['2']), item('2', ['1'], ['1'])])).toThrow('cycle');
    expect(() => parseAgentWorkItemBoard({ version: 1, nextId: 2, items: [item('1', ['1'], ['1'])] })).toThrow('dependency list');
  });

  it('rejects invalid high-water marks so deleted IDs cannot be reused', () => {
    expect(() => parseAgentWorkItemBoard({ version: 1, nextId: 1, items: [item('1')] })).toThrow('next ID');
  });
});
