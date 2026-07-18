import {
  MAX_MCP_RESOURCE_BLOB_BYTES,
  MAX_MCP_RESOURCE_TEXT_CHARACTERS,
  MAX_MCP_RESOURCE_TOTAL_TEXT_CHARACTERS,
  MAX_MCP_RESOURCE_URI_CHARACTERS,
  type McpResourceContent,
} from '../../domain/entities/mcpResource.js';
import type { IMcpResourceArtifactStore } from '../../domain/ports/IMcpResourceArtifactStore.js';
import type { IMcpResourceGateway } from '../../domain/ports/IMcpResourceGateway.js';

const MAX_CONTENT_BLOCKS = 64;
const MAX_MIME_TYPE_CHARACTERS = 256;
type McpResourceLimits = { uri: number; text: number; totalText: number; blobBytes: number };
const DEFAULT_LIMITS: McpResourceLimits = {
  uri: MAX_MCP_RESOURCE_URI_CHARACTERS,
  text: MAX_MCP_RESOURCE_TEXT_CHARACTERS,
  totalText: MAX_MCP_RESOURCE_TOTAL_TEXT_CHARACTERS,
  blobBytes: MAX_MCP_RESOURCE_BLOB_BYTES,
};

export class ReadMcpResource {
  private readonly gateway: IMcpResourceGateway;
  private readonly artifacts: IMcpResourceArtifactStore;
  private readonly limits: McpResourceLimits;

  constructor(
    gateway: IMcpResourceGateway,
    artifacts: IMcpResourceArtifactStore,
    limits: Partial<McpResourceLimits> = {},
  ) { this.gateway = gateway; this.artifacts = artifacts; this.limits = { ...DEFAULT_LIMITS, ...limits }; }

  async execute(input: { server?: unknown; uri?: unknown }, signal?: AbortSignal): Promise<{ contents: McpResourceContent[] }> {
    const serverName = requiredString(input.server, 'server');
    const uri = requiredString(input.uri, 'uri');
    validateUri(uri, this.limits.uri);
    const servers = await this.gateway.listServers();
    const server = servers.find((candidate) => candidate.name === serverName);
    if (!server) throw new Error(`Server "${serverName}" not found. Available servers: ${servers.map((item) => item.name).join(', ')}`);
    if (server.state !== 'connected') throw new Error(`Server "${serverName}" is not connected`);
    if (!server.supportsResources) throw new Error(`Server "${serverName}" does not support resources`);

    const raw = await this.gateway.readResource(server.id, uri, signal);
    if (raw.length > MAX_CONTENT_BLOCKS) throw new Error(`MCP resource returned more than ${MAX_CONTENT_BLOCKS} content blocks.`);
    const contents: McpResourceContent[] = [];
    let totalText = 0;
    for (const block of raw) {
      validateUri(block.uri, this.limits.uri);
      const mimeType = boundedMimeType(block.mimeType);
      if (typeof block.text === 'string') {
        if (block.text.length > this.limits.text) throw new Error('MCP resource text content is too large.');
        totalText += block.text.length;
        if (totalText > this.limits.totalText) throw new Error('MCP resource total text content is too large.');
        contents.push({ uri: block.uri, mimeType, text: block.text });
        continue;
      }
      if (typeof block.blob !== 'string') {
        contents.push({ uri: block.uri, mimeType });
        continue;
      }
      try {
        if (estimatedDecodedBytes(block.blob) > this.limits.blobBytes) throw new Error('binary resource exceeds the configured size limit');
        const persisted = await this.artifacts.persistBase64({ base64: block.blob, mimeType });
        contents.push({
          uri: block.uri, mimeType, blobSavedTo: persisted.path,
          text: `[Resource from ${serverName} at ${block.uri}] Binary content (${mimeType || 'unknown type'}, ${persisted.size} bytes) saved to ${persisted.path}`,
        });
      } catch (error) {
        contents.push({
          uri: block.uri, mimeType,
          text: `Binary content could not be saved to disk: ${error instanceof Error ? error.message : 'unknown persistence error'}`,
        });
      }
    }
    return { contents };
  }
}

function requiredString(value: unknown, name: string) {
  if (typeof value !== 'string' || !value) throw new Error(`${name} is required.`);
  return value;
}

function validateUri(uri: string, maximum: number) {
  if (!uri || uri.length > maximum || [...uri].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  })) {
    throw new Error('MCP resource URI is invalid or too long.');
  }
}

function boundedMimeType(value: string | undefined) {
  if (value === undefined) return undefined;
  if (value.length > MAX_MIME_TYPE_CHARACTERS || [...value].some((character) => [0, 10, 13].includes(character.charCodeAt(0)))) {
    throw new Error('MCP resource MIME type is invalid or too long.');
  }
  return value;
}

function estimatedDecodedBytes(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}
