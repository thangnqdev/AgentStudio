import { describe, expect, it, vi } from 'vitest';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { ILanguageServerGateway } from '../../domain/ports/ILanguageServerGateway.js';
import { LspToolPlatform } from './LspToolPlatform.js';

const baseTool: AgentToolDefinition = { name: 'read_file', description: 'read', risk: 'read', parameters: {} };

describe('LspToolPlatform', () => {
  it('only exposes the deferred LSP tool when a server is configured', async () => {
    const gateway = createGateway();
    const platform = createPlatform(gateway);
    await expect(platform.list('/workspace')).resolves.toEqual([baseTool, expect.objectContaining({ name: 'LSP', deferLoading: true })]);
    vi.mocked(gateway.isAvailable).mockResolvedValue(false);
    await expect(platform.list('/workspace')).resolves.toEqual([baseTool]);
  });

  it('runs strict input through the use case and delegates other tools', async () => {
    const gateway = createGateway();
    const platform = createPlatform(gateway);
    await expect(platform.execute('LSP', {
      operation: 'goToDefinition', filePath: 'src/main.ts', line: 1, character: 1,
    }, '/workspace', 'read-only')).resolves.toEqual({ ok: true, output: 'Defined in src/target.ts:2:3' });
    expect(gateway.execute).toHaveBeenCalledWith(expect.objectContaining({ line: 1, character: 1 }), '/workspace', undefined);
    await expect(platform.execute('LSP', {
      operation: 'hover', filePath: 'src/main.ts', line: 0, character: 1,
    }, '/workspace', 'read-only')).resolves.toMatchObject({ ok: false, output: expect.stringContaining('positive integer') });
    await expect(platform.execute('read_file', {}, '/workspace', 'read-only')).resolves.toEqual({ ok: true, output: 'delegated' });
  });
});

function createGateway(): ILanguageServerGateway {
  return {
    isAvailable: vi.fn(async () => true),
    execute: vi.fn(async () => ({
      kind: 'locations' as const,
      locations: [{ filePath: 'src/target.ts', range: { start: { line: 1, character: 2 }, end: { line: 1, character: 4 } } }],
    })),
  };
}

function createPlatform(gateway: ILanguageServerGateway) {
  const catalog = { list: vi.fn(async () => [baseTool]) };
  const executor = { execute: vi.fn(async () => ({ ok: true, output: 'delegated' })) };
  return new LspToolPlatform(catalog, executor, gateway);
}
