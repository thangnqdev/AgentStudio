import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LspProcessClient } from './StdioLspClient.js';
import { WorkspaceLspServerManager } from './WorkspaceLspServerManager.js';

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

describe('WorkspaceLspServerManager', () => {
  it('lazily initializes, opens once, and converts editor positions to LSP positions', async () => {
    const root = await workspace();
    const requests: Array<{ method: string; params: unknown }> = [];
    const notifications: Array<{ method: string; params: unknown }> = [];
    const client = fakeClient(requests, notifications, (method) => method === 'textDocument/definition'
      ? [{ uri: pathToFileURL(path.join(root, 'src', 'target.ts')).href, range: range(4, 2) }]
      : {});
    const manager = createManager(root, client);

    const result = await manager.execute({ operation: 'goToDefinition', filePath: 'src/main.ts', line: 3, character: 5 }, root);
    expect(result).toEqual({ kind: 'locations', locations: [{ filePath: 'src/target.ts', range: range(4, 2) }] });
    expect(requests.find((request) => request.method === 'textDocument/definition')?.params)
      .toMatchObject({ position: { line: 2, character: 4 } });
    await manager.execute({ operation: 'goToDefinition', filePath: 'src/main.ts', line: 3, character: 5 }, root);
    expect(notifications.filter((item) => item.method === 'textDocument/didOpen')).toHaveLength(1);
    await manager.shutdown();
  });

  it('performs the two-step incoming call hierarchy request', async () => {
    const root = await workspace();
    const requests: Array<{ method: string; params: unknown }> = [];
    const client = fakeClient(requests, [], (method) => {
      if (method === 'textDocument/prepareCallHierarchy') return [{ name: 'target', kind: 12, uri: pathToFileURL(path.join(root, 'src/main.ts')).href, range: range(0) }];
      if (method === 'callHierarchy/incomingCalls') return [{ from: { name: 'caller', kind: 12, uri: pathToFileURL(path.join(root, 'src/caller.ts')).href, range: range(2) }, fromRanges: [range(5, 1)] }];
      return {};
    });
    const manager = createManager(root, client);
    const result = await manager.execute({ operation: 'incomingCalls', filePath: 'src/main.ts', line: 1, character: 1 }, root);
    expect(requests.map((request) => request.method)).toContain('callHierarchy/incomingCalls');
    expect(result).toMatchObject({ kind: 'incomingCalls', calls: [{ from: { filePath: 'src/caller.ts' } }] });
    await manager.shutdown();
  });

  it('blocks workspace escape and returns undefined for unsupported extensions', async () => {
    const root = await workspace();
    const manager = createManager(root, fakeClient([], [], () => ({})));
    await expect(manager.execute({ operation: 'hover', filePath: '../secret.ts', line: 1, character: 1 }, root))
      .rejects.toThrow('escapes workspace');
    await fs.writeFile(path.join(root, 'notes.txt'), 'text');
    await expect(manager.execute({ operation: 'hover', filePath: 'notes.txt', line: 1, character: 1 }, root)).resolves.toBeUndefined();
    await manager.shutdown();
  });

  it('publishes didChange and didSave with monotonically increasing versions after an opened file changes', async () => {
    const root = await workspace();
    const notifications: Array<{ method: string; params: unknown }> = [];
    const manager = createManager(root, fakeClient([], notifications, () => null));
    await manager.execute({ operation: 'hover', filePath: 'src/main.ts', line: 1, character: 1 }, root);
    await fs.writeFile(path.join(root, 'src/main.ts'), 'const value = 2;');
    await manager.fileChanged(path.join(root, 'src/main.ts'));
    expect(notifications.find((item) => item.method === 'textDocument/didChange')?.params)
      .toMatchObject({ textDocument: { version: 2 }, contentChanges: [{ text: 'const value = 2;' }] });
    expect(notifications.map((item) => item.method)).toContain('textDocument/didSave');
    await manager.shutdown();
  });

  it('captures publishDiagnostics and resets cross-turn dedupe when the file changes', async () => {
    const root = await workspace();
    const handlers = new Map<string, (params: unknown) => unknown>();
    const client = fakeClient([], [], () => null, handlers);
    const diagnosticSink = { publish: vi.fn(), clearFile: vi.fn() };
    const manager = new WorkspaceLspServerManager(root, [{
      name: 'typescript', command: 'fixture-server', extensionToLanguage: { '.ts': 'typescript' },
    }], () => client, diagnosticSink);

    await manager.execute({ operation: 'hover', filePath: 'src/main.ts', line: 1, character: 1 }, root);
    const canonicalFile = await fs.realpath(path.join(root, 'src/main.ts'));
    await handlers.get('textDocument/publishDiagnostics')?.({
      uri: pathToFileURL(path.join(root, 'src/main.ts')).href,
      diagnostics: [{ message: 'broken', severity: 1, range: range(0) }],
    });
    expect(diagnosticSink.publish).toHaveBeenCalledWith('typescript', [{
      uri: pathToFileURL(canonicalFile).href,
      filePath: 'src/main.ts',
      diagnostics: [{ message: 'broken', severity: 'Error', range: range(0) }],
    }]);

    await manager.fileChanged('src/main.ts');
    expect(diagnosticSink.clearFile).toHaveBeenCalledWith(pathToFileURL(canonicalFile).href);
    await manager.shutdown();
  });
});

function createManager(root: string, client: LspProcessClient) {
  return new WorkspaceLspServerManager(root, [{
    name: 'typescript', command: 'fixture-server', args: ['--stdio'], extensionToLanguage: { '.ts': 'typescript' },
  }], () => client);
}

function fakeClient(
  requests: Array<{ method: string; params: unknown }>,
  notifications: Array<{ method: string; params: unknown }>,
  response: (method: string, params: unknown) => unknown,
  notificationHandlers?: Map<string, (params: unknown) => unknown>,
): LspProcessClient {
  let started = false;
  return {
    get started() { return started; },
    start: vi.fn(async () => { started = true; }),
    sendRequest: vi.fn(async (method, params) => { requests.push({ method, params }); return response(method, params); }),
    sendNotification: vi.fn(async (method, params) => { notifications.push({ method, params }); }),
    onNotification: vi.fn((method, handler) => { notificationHandlers?.set(method, handler); }),
    onRequest: vi.fn(),
    stop: vi.fn(async () => { started = false; }),
  };
}

async function workspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-lsp-'));
  temporaryDirectories.push(root);
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'src', 'main.ts'), 'const value = 1;');
  return root;
}

function range(line: number, character = 0) {
  return { start: { line, character }, end: { line, character: character + 1 } };
}
