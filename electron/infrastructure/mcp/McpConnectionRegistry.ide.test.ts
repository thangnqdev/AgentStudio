import { describe, expect, it, vi } from 'vitest';
import type { IIdeContextSink } from '../../domain/ports/IIdeContextSink.js';
import { McpResourceCache } from './McpResourceCache.js';

const mocks = vi.hoisted(() => ({ clients: [] as Array<Record<string, unknown>> }));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    fallbackNotificationHandler?: (notification: unknown) => Promise<void>;
    onclose?: () => void;
    onerror?: (error: Error) => void;

    constructor() { mocks.clients.push(this as unknown as Record<string, unknown>); }
    async connect() {}
    async close() { this.onclose?.(); }
    getServerCapabilities() { return {}; }
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {},
  getDefaultEnvironment: () => ({}),
}));
vi.mock('./McpRemoteToolPlatform.js', () => ({ discoverRemoteTools: async () => new Map() }));

import { McpConnectionRegistry } from './McpConnectionRegistry.js';

describe('McpConnectionRegistry IDE notifications', () => {
  it('routes bounded selection_changed only from the configured ide connection and clears it on stop', async () => {
    const sink: IIdeContextSink = { publishSelection: vi.fn(), publishAtMention: vi.fn(), clear: vi.fn() };
    const registry = new McpConnectionRegistry(new McpResourceCache(), undefined, sink);
    await registry.start(config('ide-1', 'ide'), {}, '/workspace');
    const ideClient = mocks.clients.at(-1) as {
      fallbackNotificationHandler: (notification: unknown) => Promise<void>;
    };
    await ideClient.fallbackNotificationHandler(selectionNotification('/workspace/main.ts'));
    expect(sink.publishSelection).toHaveBeenCalledWith('ide-1', {
      filePath: '/workspace/main.ts', text: 'selected', lineStart: 1, lineEnd: 1,
    });
    await ideClient.fallbackNotificationHandler({
      method: 'at_mentioned', params: { filePath: '/workspace/other.ts', lineStart: 2, lineEnd: 3 },
    });
    expect(sink.publishAtMention).toHaveBeenCalledWith('ide-1', {
      filePath: '/workspace/other.ts', lineStart: 3, lineEnd: 4,
    });

    await registry.start(config('docs-1', 'documentation'), {}, '/workspace');
    const docsClient = mocks.clients.at(-1) as typeof ideClient;
    await docsClient.fallbackNotificationHandler(selectionNotification('/workspace/secret.ts'));
    expect(sink.publishSelection).toHaveBeenCalledTimes(1);

    await registry.stop('ide-1');
    expect(sink.clear).toHaveBeenCalledWith('ide-1');
  });
});

function config(id: string, name: string) {
  return {
    id, name, transport: { type: 'stdio' as const, command: 'unused', args: [] },
    autoStart: false, defaultRisk: 'read' as const, hasCredentials: false,
  };
}

function selectionNotification(filePath: string) {
  return {
    method: 'selection_changed', params: {
      filePath, text: 'selected',
      selection: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } },
    },
  };
}
