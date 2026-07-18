import { describe, expect, it } from 'vitest';
import { findComposerCommands } from './composerCommands';

describe('findComposerCommands', () => {
  it('shows a bounded command palette only for a single slash token', () => {
    expect(findComposerCommands('/')).toHaveLength(7);
    expect(findComposerCommands(' /')).toEqual([]);
    expect(findComposerCommands('/plan now')).toEqual([]);
  });

  it('ranks canonical and alias matches before broader matches', () => {
    expect(findComposerCommands('/mcp').map((command) => command.name)).toEqual(['mcp']);
    expect(findComposerCommands('/settings')[0]?.name).toBe('config');
    expect(findComposerCommands('/sand')[0]?.name).toBe('permissions');
    expect(findComposerCommands('/continue')[0]?.name).toBe('resume');
    expect(findComposerCommands('/rename')[0]?.action).toEqual({ kind: 'open-picker', picker: 'rename' });
    expect(findComposerCommands('/tokens')[0]?.action).toEqual({ kind: 'open-picker', picker: 'context' });
    expect(findComposerCommands('/status')[0]?.action).toEqual({ kind: 'open-picker', picker: 'status' });
    expect(findComposerCommands('/hooks')[0]?.action).toEqual({ kind: 'open-picker', picker: 'hooks' });
    expect(findComposerCommands('/compact')[0]?.action).toEqual({ kind: 'open-picker', picker: 'compact' });
  });

  it('returns only commands with real local actions', () => {
    const actions = findComposerCommands('/', 20).map((command) => command.action.kind);
    expect(actions).toContain('navigate');
    expect(actions).toContain('open-picker');
    expect(actions).toContain('clear-thread');
    expect(actions).toContain('new-thread');
    expect(actions).toContain('insert');
  });
});
