import type { AgentToolDefinition } from './tool.js';

export const LIST_MCP_RESOURCES_TOOL_NAME = 'ListMcpResourcesTool';
export const READ_MCP_RESOURCE_TOOL_NAME = 'ReadMcpResourceTool';
export const MAX_MCP_RESOURCE_URI_CHARACTERS = 8_192;
export const MAX_MCP_RESOURCE_TEXT_CHARACTERS = 5_000_000;
export const MAX_MCP_RESOURCE_TOTAL_TEXT_CHARACTERS = 10_000_000;
export const MAX_MCP_RESOURCE_BLOB_BYTES = 25 * 1024 * 1024;
export const MAX_MCP_RESOURCE_RESULT_CHARACTERS = 100_000;
export const DEFAULT_MCP_ARTIFACT_READ_CHARACTERS = 50_000;
export const MAX_MCP_ARTIFACT_READ_CHARACTERS = 100_000;
export const MAX_MCP_ARTIFACT_OFFSET_CHARACTERS = MAX_MCP_RESOURCE_BLOB_BYTES;

export type McpResourceServer = {
  id: string;
  name: string;
  state: 'stopped' | 'starting' | 'connected' | 'needs-auth' | 'error';
  supportsResources: boolean;
};

export type McpResourceDescriptor = {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
  server: string;
};

export type McpRawResourceContent = {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
};

export type McpResourceContent = {
  uri: string;
  mimeType?: string;
  text?: string;
  blobSavedTo?: string;
};

export const MCP_RESOURCE_TOOL_DEFINITIONS: readonly AgentToolDefinition[] = [
  {
    name: LIST_MCP_RESOURCES_TOOL_NAME,
    description: [
      'Lists available resources from configured MCP servers.',
      "Each resource object includes a 'server' field indicating which server it is from.",
      'Optionally provide server to list resources from one exact server name.',
    ].join(' '),
    risk: 'read', readOnly: true, concurrencySafe: true, deferLoading: true,
    searchHint: 'list resources from connected MCP servers',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        server: { type: 'string', description: 'Optional server name to filter resources by' },
      },
    },
  },
  {
    name: READ_MCP_RESOURCE_TOOL_NAME,
    description: 'Reads a specific resource from an MCP server, identified by server name and resource URI.',
    risk: 'read', readOnly: true, concurrencySafe: true, deferLoading: true,
    searchHint: 'read a specific MCP resource by URI',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        server: { type: 'string', description: 'The MCP server name' },
        uri: { type: 'string', description: 'The resource URI to read' },
      },
      required: ['server', 'uri'],
    },
  },
];
