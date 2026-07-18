import { describe, expect, it, vi } from 'vitest';
import type { IMcpResourceArtifactStore } from '../../domain/ports/IMcpResourceArtifactStore.js';
import type { IMcpResourceGateway } from '../../domain/ports/IMcpResourceGateway.js';
import { ReadMcpResource } from './ReadMcpResource.js';

function createHarness() {
  const gateway: IMcpResourceGateway = {
    listServers: vi.fn(async () => [{ id: 'docs', name: 'docs', state: 'connected' as const, supportsResources: true }]),
    listResources: vi.fn(async () => []),
    readResource: vi.fn(async () => []),
  };
  const artifacts: IMcpResourceArtifactStore = {
    persistBase64: vi.fn(async () => ({ path: '/private/blob.bin', size: 3 })),
    persistToolResult: vi.fn(async () => ({ path: '/private/result.json', size: 0 })),
    canReadTextArtifact: vi.fn(() => false),
    readTextArtifact: vi.fn(async () => ({ content: '', offset: 0, totalCharacters: 0 })),
  };
  const usecase = new ReadMcpResource(gateway, artifacts, { uri: 20, text: 5, totalText: 8, blobBytes: 2 });
  return { usecase, gateway, artifacts };
}

describe('ReadMcpResource bounds', () => {
  it('rejects oversized and control-character resource URIs before the SDK call', async () => {
    const { usecase, gateway } = createHarness();
    await expect(usecase.execute({ server: 'docs', uri: 'docs://this-uri-is-far-too-long' })).rejects.toThrow('URI is invalid or too long');
    await expect(usecase.execute({ server: 'docs', uri: 'docs://bad\nuri' })).rejects.toThrow('URI is invalid or too long');
    expect(gateway.readResource).not.toHaveBeenCalled();
  });

  it('bounds individual and aggregate text content', async () => {
    const individual = createHarness();
    vi.mocked(individual.gateway.readResource).mockResolvedValueOnce([{ uri: 'docs://one', text: '123456' }]);
    await expect(individual.usecase.execute({ server: 'docs', uri: 'docs://one' })).rejects.toThrow('text content is too large');

    const aggregate = createHarness();
    vi.mocked(aggregate.gateway.readResource).mockResolvedValueOnce([
      { uri: 'docs://one', text: '12345' }, { uri: 'docs://two', text: '6789' },
    ]);
    await expect(aggregate.usecase.execute({ server: 'docs', uri: 'docs://one' })).rejects.toThrow('total text content is too large');
  });

  it('does not decode or persist an oversized blob', async () => {
    const { usecase, gateway, artifacts } = createHarness();
    vi.mocked(gateway.readResource).mockResolvedValueOnce([{ uri: 'docs://blob', mimeType: 'image/png', blob: 'YWJj' }]);
    const result = await usecase.execute({ server: 'docs', uri: 'docs://blob' });
    expect(result.contents[0].text).toContain('configured size limit');
    expect(artifacts.persistBase64).not.toHaveBeenCalled();
  });
});
